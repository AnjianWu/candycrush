// Hand it in this way: for simpler testing, always use the same seed.
Math.seedrandom(0);

// constants
const DEFAULT_BOARD_SIZE = 8;
// set size from URL or to default
const size = Math.min(10, Math.max(3, +Util.getURLParam("size") || DEFAULT_BOARD_SIZE));

//How often should the hint timer event occur? (i.e how often to check whether it's hint time)
const hint_interval = 1000;

console.log(size); // for debug purposes

// Global variable for keep track of time since last user action (used for auto hint)
var lastmove = new Date().getTime();

// Bool used to enable auto hint
var showing_hint = true;


//Tell CSS what the size of board is for adjustment purposes
document.documentElement.style.setProperty("--shape-size",size+1);

// Adjust size of cell based on size value and grid OUTLINE is 1 px
// Notice that I consider the x and y board labels as part of the board (size + 1 rows and cols)


// Quickly convert letter col to number for indexing
const board_col_labels = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i','j', 'k', 'l', 'm','n','o','p'];

//Holds DOM elements that don’t change
//to avoid repeatedly querying the DOM

var dom = {};

// data model at global scope for easier debugging
// initialize board model
var board = new Board(size);

// load a rule
var rules = new Rules(board);

//Get a new game going
rules.prepareNewGame();


//This function pulses ONE candy (of a given row and col) by setting the target candy's IMG
//to candy_pulsing class
function pulse_candy(row,col){
	gameboard = Util.one("#gameboard");
	// Directly set the class of each candy image to pulsing mode
	gameboard.getElementsByTagName("tr")[row+1].getElementsByTagName("td")[col+1].getElementsByTagName("img")[0].setAttribute("class","candy_pulsing");
}

//This function crushes ONE candy (of a given row and col) by setting the target candy's IMG
//to candy_crushed class so that candy disappears in a transistion
function crush_candy(row,col){
	gameboard = Util.one("#gameboard");
	// Directly set the class of each candy image to pulsing mode
	candy_of_interest = gameboard.getElementsByTagName("tr")[row+1].getElementsByTagName("td")[col+1].getElementsByTagName("img")[0];
	candy_of_interest.setAttribute("class","candy_crushed");
	return candy_of_interest;
}

//This is a helper function to return the document element object at row and col in the game board
//This is used in pulse and crush candy functions
function Get_Candy_Element(row,col){
	gameboard = Util.one("#gameboard");
	candy_of_interest = gameboard.getElementsByTagName("tr")[row+1].getElementsByTagName("td")[col+1].getElementsByTagName("img")[0];
	return candy_of_interest;
}


//Crush ALL the candies of interest
//Returns a PROMISE for timing purposes
function crush_candies(candies)
{
	for (j = 0; j < candies.length; j++)
		{
		for (i = 0; i < candies[j].length; i++)
		{
			// individually pulse each candy
			candy_of_interest = crush_candy(candies[j][i].row, candies[j][i].col);
		}
		}		
		return Util.afterAnimation(candy_of_interest, "disappear");
}

// Redraw the grid to reflect current state of the board
// Removes all animations (if there is one due to HINT)

function drawgrid(board){
	
	console.log("redrawing!");
	var game = document.querySelector('#gameboard');

	// Clean it out!
	while (game.firstChild)
	{
		game.removeChild(game.firstChild);
	}
	
	//Add Row Labels
	
	//The first is just blank
	row = document.createElement('tr');
	col = document.createElement('td');
	col.setAttribute('class', 'grid_label');
	row.append(col);
	game.append(row);
	
	// Now fill with LETTERS needed in the rows
	for (var columns = 0; columns < size; columns++)
	{
		col = document.createElement('td');
		col.setAttribute('class', 'grid_label'); // Use class based
		col.innerHTML = board_col_labels[columns];
		row.append(col);
	}
	game.append(row);
	
	
	//Ok NOW we have to draw the horizontal labels and candies
	
	for (var rows = 0; rows < size; rows++)
	{
		row = document.createElement('tr');
		
		//First add the next row's label in front
		col = document.createElement('td');
		col.setAttribute('class', 'grid_label');
		col.innerHTML = rows + 1;
		row.append(col);
		
		//Now add all candies of this row
		for (columns = 0; columns < size; columns++)
		{
			
			col = document.createElement('td');
			col.setAttribute('class', 'grid');

			//Get the candy object
			candy = board.getCandyAt(rows,columns);

			// Parse whether it is empty or a candy
			if (typeof candy != 'undefined')
			{
				//There is candy, find image and place
				candy_img = document.createElement('img');
				candy_img.setAttribute('src', "./graphics/"+candy.color+"-candy.png");
				candy_img.setAttribute('id', rows+board_col_labels[columns]);
				candy_img.setAttribute('draggable',false);
				
				const id = rows+board_col_labels[columns];
				
				// Attached event mouse up and down event handlers to every candy!!!
				candy_img.onmousedown = function(){Start_Dragging_Candy(id);};
				candy_img.onmouseup = function(){Stop_Dragging_Candy(id);};
				
				
				//Maybe Support touch later
				//candy_img.touchstart = function(){Start_Dragging_Candy(id);};
				//candy_img.touchend = function(){Stop_Dragging_Candy(id);};
				
				col.append(candy_img);
			}else{
				//There is NO candy
				candy_img = document.createElement('img');
				candy_img.setAttribute('src', "./graphics/empty.png");
				col.append(candy_img);
			}
			
			//Add that col and repeat if needed
			row.append(col);
		}
		game.append(row);
	}

}


// A Simple Look up table converting letters to number
function lookup_table(letter) {
  return board_col_labels.slice(0,size).indexOf(letter);
}


//Resets Game with new board, and default UI visuals
function NewGameReset(){
		console.log("Game Reset");

		
		//Clear Score value and color
		Util.one("#score").innerHTML = 0;
		Util.one("#points").setAttribute("class", "grey_background");
		Util.one("#score").setAttribute("class", "grey_background");
		Util.one("#point_text").setAttribute("class", "grey_background");
		
		
		//Reset all event flags
		crushing_in_progress = false;
		showing_hint = true;
		lastmove = new Date().getTime();
		
		
}


//Checks EVERY column, and shifts candies down by ONE cell if there are any empty
//Will be called repeatedly until there are NO MORE EMPTY CELLS
// This is both a FRONT END and BACKEND shift
//Returns a PROMISE for timing purposes or NULL if there are no more empty
function Move_Candies_Down_Once(){
	
	var anyempty = false;
	// Collapse each column
	for (var col = 0; col < board.boardSize; col++) {
		var emptyRow = null;
		
		var something_empty = false;
		// In each column, scan for the TOP most empty row
		for (emptyRow = 0; emptyRow < board.boardSize; emptyRow++) {
			if (board.getCandyAt(emptyRow, col) == null) {
				anyempty = true;
				something_empty = true;
				break;
			}
		}
		
		if (something_empty){ // There is an empty cell!!!!
			// Then shift candies down ONE step
			for (var row = emptyRow - 1; row >= 0; row--) {
				var candy = board.getCandyAt(row, col);
	
				if (candy != null) {
					board.moveTo(candy, emptyRow, col);
					emptyRow--;
				}
				
				//Start Animation of Drop Down
				candy_ele = Get_Candy_Element(row,col);
				candy_ele.style.setProperty('--to-y', gridbox_size+"px");
				candy_ele.setAttribute("class", "candy_swap");
			}
	
			for (var spawnRow = -1; emptyRow >= 0; emptyRow--, spawnRow--) {
				// We report spawnRow as the (negative) position where
				// the candy "would have" started to fall into place.
				board.addRandomCandy(emptyRow, col, spawnRow, col);
			}
		}
	}
	return [anyempty, Util.afterAnimation(candy_ele, "swap")];
}

//Recursive Loop until No Move Candies can be moved
//Works by calling Move_Candies_Down_Once recursively
//Once shifting down is complete, it then recursively calls crush_everything again
// to see if there are any other candy crushes needed

function Move_Candies()
{
	latest_promise = null;
	//if (keep_moving) // keep moving only if non-empty cells detected
	//{
	console.log("Shift down by one!"); //debug
	results = Move_Candies_Down_Once(); // Shift down by one cell on all columns with empty
	//console.log("Results are "+results); //debug
	latest_promise = results[1]; // take the promise
	keep_moving = results[0];
	
	if (keep_moving)
	{
		  new_promise = latest_promise.then(function(){
			drawgrid(board);
			last_promise = Move_Candies();
			}); // Recursively APPEND THE PROMISE
			//This trick ensures that each downshift has the same timing and occurs sequentially!
			
	}else{
		console.log("Shifting is done!"); //debug
		crush_everything();
	}

}

function crush_everything()
{
	console.log("Calling crusheverything");
	if (rules.getCandyCrushes().length > 0)
	{
		console.log("more crushes left!");
		candies_tobe_crushed = rules.getCandyCrushes();
		
		//Update Color!
		color_of_candy = candies_tobe_crushed[0][0].color;
		console.log(color_of_candy);
		Util.one("#points").setAttribute("class", color_of_candy+"_background");
		Util.one("#score").setAttribute("class", color_of_candy+"_background");
		Util.one("#point_text").setAttribute("class", color_of_candy+"_background");
		
		crush_promise = crush_candies(candies_tobe_crushed);
		
		crush_promise.then(function()
		{
			console.log("crush and move animation go!");
			rules.removeCrushes(candies_tobe_crushed);
			
			//Now move candies down (backend and frontend)
			
			Move_Candies(); // Move Candy will eventually call crush_everything back

		});
	}else{
		
	  // OK we are done crushing all candies.
	
		console.log("Crushing Done");
		
		//Resume auto hint
		lastmove = new Date().getTime();
		showing_hint = true;
		
		//Allow candies to be dragged again
		crushing_in_progress = false;

	}
	
	
}

//Check whether we need to show hint autoamtically after 5 seconds
function check_hint()
{
	
	// Did we already show hint? Or are there no ongoing drags/animations?
	if (showing_hint){
		console.log("Checking hint...");
		
		//Get the time since last action
		time_since_last_move = (new Date().getTime()) - lastmove;
		var seconds_since_last_move = Math.floor((time_since_last_move % (1000 * 60)) / 1000);
		
		// If it's been over 5 seconds since last action, then start the hint
		if (seconds_since_last_move >= 5)
		{
			
				
			console.log("Showing hint..."); //debug
			//Get the random move
			random_move = rules.getRandomValidMove();
			
			//Are there any possible moves?
			if (random_move == null){
				
				console.log("Game Over");
				
				return;
			}
			
			// Ok time to give the hint!
			candies_to_pulse = rules.getCandiesToCrushGivenMove(random_move.candy, random_move.direction);
			
			// Clear Board of any animations from past
			drawgrid(board);
			
			//Pulse each candy of interest individually
			for (i = 0; i < candies_to_pulse.length; i++) {
				// individually pulse each candy
				pulse_candy(candies_to_pulse[i].row, candies_to_pulse[i].col);
			}
			
			// No more hints needed
			showing_hint = false;
		
		}
	}
	
	
}

//Mouse stuff

var x_mouse_ref = 0; // absolute coord of initial mouse down click
var y_mouse_ref = 0; // absolute coord of initial mouse down click

var mouse_drag_init = true; //flag used to determine whether we have gotten initial mouse location
var candy_drag_id = ""; // current candy being dragged


// Event handler that is active during a drag
function ReadMouseMove(e){
	//console.log("Mouse Moved!");
	
	var margin_window = 0.01;
	
	// Check if mouse is about to leave the window!!!
	//If so, end the dragging ASAP
	if ((e.clientX < window.innerWidth*margin_window) || (e.clientX > window.innerWidth*(1-margin_window)))
	{
		Stop_Dragging_Candy(candy_drag_id);
		return;
	}
	if ((e.clientY < window.innerHeight*margin_window) || (e.clientY > window.innerHeight*(1-margin_window)))
	{
		Stop_Dragging_Candy(candy_drag_id);
		return;
	}
	
	// Ok now lets move the candy by aligning with relative displacement so far
	if (!mouse_drag_init){
		console.log("Init Loc Logged!");
		x_mouse_ref = e.clientX;
		y_mouse_ref = e.clientY;
		console.log(x_mouse_ref+", "+y_mouse_ref);
		mouse_drag_init = true;
	}else{
		
		//Calc and update image to new relative position!!!
		document.getElementById(candy_drag_id).style.left = (e.clientX - x_mouse_ref)+"px";
		document.getElementById(candy_drag_id).style.top = (e.clientY - y_mouse_ref)+"px";

	}
	
	
	
}

//on mouse event handler for each candy image
function Start_Dragging_Candy(id)
{
	// Are there crushing animations in progress? If so, ignore drag attempt!
	
	if (!crushing_in_progress){
		
		//Pause showing hint
		showing_hint = false;
		
		// Clear any hint animations
		drawgrid(board);
	
		console.log("Start Drag Candy: "+id); // debug
		
		// Get the latest candy being dragged
		candy_drag_id = id;
		mouse_drag_init = false;
		
		//Prepare candy to move in relative manner
		document.getElementById(candy_drag_id).style.position = 'relative';
		
		//Activate mouse tracking event handler
		document.onmousemove = ReadMouseMove;
	}
}

var crushing_in_progress = false;


//Gets called everytime a drag is attempted
//Either the drag is LEGAL or ILLEGAL
function Crush_Anything(){
	
  
	//Get candy elements being crushed
	candies_tobe_crushed = rules.getCandyCrushes();
	
	// Are there any candys to crush?
	if (candies_tobe_crushed.length > 0)
	{
		
		crush_everything();
	}else{
		//Ok restore the hint timer
		console.log("Crushing Done");
		
		lastmove = new Date().getTime();
		showing_hint = true;
		
		crushing_in_progress = false;
	}
}

//up mouse event handler for each candy image

function Stop_Dragging_Candy(id)
{
	//Only do something if there isn't any other crushes happening
	if (!crushing_in_progress){
		
		crushing_in_progress = true; // stop any other dragging attempts
		
		//stop mouse tracking
		document.onmousemove = false;
	
		console.log("Stop Drag Candy: "+id);
		candy_drag_id = id;

		// Ok TRY to snap to the nearest grid that the candy was dropped at		
		snap_promise = Snap_To_Nearest_Grid(id);
		
		//Check if there is anything to even crush
		snap_promise.then(function(){
			Crush_Anything();});
		
		
	}
}


//Determine whether TWO candy img html elements are indeed "overlapping"
//"Overlapping" is defined as whether the image centers of both are within a min distance from each other
function Determine_if_Overlap(ele1, ele2)
{
	rect1 = ele1.getBoundingClientRect();
	rect2 = ele2.getBoundingClientRect();
	
	min_dist_req = rect1.width/2;// in this case, I define overlap is when centers are within 50% of the image width
	
	x1_center = rect1.x + rect1.width/2;
	y1_center = rect1.y + rect1.width/2;
	
	x2_center = rect2.x + rect2.width/2;
	y2_center = rect2.y + rect2.width/2;
	
	//Find cartesian distance
	dist_center_to_center = Math.pow(Math.pow((x1_center-x2_center), 2)+Math.pow((y1_center-y2_center), 2) , 0.5);
	
	//console.log("Dist at:" +dist_center_to_center);
	//console.log("Min at:" +min_dist_req);

	if (dist_center_to_center <= min_dist_req)
	{
		//console.log("true!!!");
		return true;
	}else
	{
		return false;
	}
	
}

// Actually Execute the Candy SWAP Mechanism given row,col, and direction
// Returns a PROMISE to allow for timing purposes
function EXECUTE_MOVE(row, col, button_dir)//, board, rules)
{
	//Get the row col of interest
	//parsed_action = parse_move(raw_text_input);

	// We need the boardsize from CSS variable
	board_size = Number(getComputedStyle(document.documentElement).getPropertyValue("--board-size").slice(0,-2));
	
	//Now we get latest candy size in px
	gridbox_size = board_size/(size+1);

	console.log("Chose: "+row+", "+col); //debug purpose

	// Now get the candy object
	candy = board.getCandyAt(row,col);
	
	//Actually flip the candies in the BACKEND
		
	other_candy = board.getCandyInDirection(candy,button_dir);
	board.flipCandies(candy,other_candy);
	
	
	// Ok now get the candy element
	candy_ele = Get_Candy_Element(row,col);
	
	//Given the DIRECTION of the swap, now do the front-end animation
	// by changing CSS variables
	//Swapping is done doing a relative offset class change
	
	if (button_dir == 'left')
	{
		other_candy_ele = Get_Candy_Element(row,col-1);
		
		candy_ele.style.setProperty('--to-x', -gridbox_size+"px");
		other_candy_ele.style.setProperty('--to-x', gridbox_size+"px");
	}
	else if (button_dir == 'right')
	{
		other_candy_ele = Get_Candy_Element(row,col+1);
		
		candy_ele.style.setProperty('--to-x', gridbox_size+"px");
		other_candy_ele.style.setProperty('--to-x', -gridbox_size+"px");
	}else if (button_dir == 'up')
	{
		other_candy_ele = Get_Candy_Element(row-1,col);
		
		candy_ele.style.setProperty('--to-y', -gridbox_size+"px");
		other_candy_ele.style.setProperty('--to-y', gridbox_size+"px");
	}else
	{
		other_candy_ele = Get_Candy_Element(row+1,col);
		
		candy_ele.style.setProperty('--to-y', gridbox_size+"px");
		other_candy_ele.style.setProperty('--to-y', +gridbox_size+"px");
	}
	

	// ok NOW that the variables are ready, actually start the animation
	candy_ele.setAttribute("class", "candy_swap");
	other_candy_ele.setAttribute("class", "candy_swap");
	return Util.afterAnimation(candy_ele, "swap");
}

// The dragged candy landed somewhere ILLEGAL. So animate moving it back
function Reset_Candy_Drag(candy_ele)
{
	candy_ele.style.setProperty('--from-x', candy_ele.style.left);
	candy_ele.style.setProperty('--from-y', candy_ele.style.top);

	candy_ele.style.setProperty('--to-x', "0px");
	candy_ele.style.setProperty('--to-y', "0px");
	candy_ele.setAttribute("class", "candy_swap");

	return Util.afterAnimation(candy_ele, "swap");

}


//Tries to snap candy dropped to the nearest LEGAL neighbor
//Snap requires that the center of the dragged candy is "Overlapping" to a target candy
function Snap_To_Nearest_Grid(id)
{
	
	//convert candy ID to row col integers
	var row = parseInt(id[0]);
	var col = board_col_labels.indexOf(id[1]);
	
	console.log("Trying to move candy at: "+row+","+col);
	
	//Assume there is no overlap
	var overlap = false;
	
	//get candy element from the row and col
	var current_candy = Get_Candy_Element(row,col);
	

	// Ok now check all 4 POSSIBLE neighbors
	if (row+1 < size) // cell below?
	{
		overlap = Determine_if_Overlap(Get_Candy_Element(row+1,col), current_candy);
		//Ok check if there is overlap AND that it is a valid swap
		if (overlap && rules.isMoveTypeValid(board.getCandyAt(row,col),"down"))
		{
			move_promise = EXECUTE_MOVE(row, col, "down");
			latest_promise = move_promise.then(function(){drawgrid(board);});
			return latest_promise;
		}
	}
	if (row-1 >= 0) // cell above?
	{
		overlap = Determine_if_Overlap(Get_Candy_Element(row-1,col), current_candy);
		//Ok check if there is overlap AND that it is a valid swap
		if (overlap && rules.isMoveTypeValid(board.getCandyAt(row,col),"up"))
		{
			move_promise = EXECUTE_MOVE(row, col, "up");
			latest_promise = move_promise.then(function(){drawgrid(board);});
			return latest_promise;
		}

	}
	if (col+1 < size) // cell right?
	{
		overlap = Determine_if_Overlap(Get_Candy_Element(row,col+1), current_candy);
		//Ok check if there is overlap AND that it is a valid swap
		if (overlap && rules.isMoveTypeValid(board.getCandyAt(row,col),"right"))
		{
			move_promise = EXECUTE_MOVE(row, col, "right");
			latest_promise = move_promise.then(function(){drawgrid(board);});
			return latest_promise;
		}
	}
	if (col-1 >= 0) // cell left?
	{
		overlap = Determine_if_Overlap(Get_Candy_Element(row,col-1), current_candy);
		//Ok check if there is overlap AND that it is a valid swap
		if (overlap && rules.isMoveTypeValid(board.getCandyAt(row,col),"left"))
		{
			move_promise = EXECUTE_MOVE(row, col, "left");
			latest_promise = move_promise.then(function(){drawgrid(board);});
			return latest_promise;
		}
	}
	
	// Ok this was not a legit drag, animate the dragged candy going back to original location
	
	console.log("Drag move illegal");
	return Reset_Candy_Drag(current_candy);
}

var myHint = setInterval(check_hint, hint_interval);
// Attaching events on document because then we can do it without waiting for
// the DOM to be ready (i.e. before DOMContentLoaded fires)
Util.events(document, {
	// Final initalization entry point: the Javascript code inside this block
	// runs at the end of start-up when the DOM is ready
	"DOMContentLoaded": function() {
		
		//Reset game at bootup
		NewGameReset();
		drawgrid(board);
		console.log("Game Loaded");//debug
		
		//Set focus on input
		//raw_text_input = Util.one("#select").value;
		//check_buttons(raw_text_input, board, rules);
		//update_buttons();
		// Element refs
		
		dom.controlColumn = Util.one("#controls"); // example

		
		//new game button event handler
		Util.one("#newgame").addEventListener("click", function(){
			console.log("new game clicked");
			rules.prepareNewGame();
			drawgrid(board);
			NewGameReset();
			}); // example
		
		
		
		// Score Update Listener
			board.addEventListener("scoreUpdate", function(){
			console.log("Score Updated!");
			
			Util.one("#score").innerHTML = board.score;
			
			});

		
	},
	// Keyboard events arrive here
	"keyup": function(evt)
	{
		console.log("key up");

	},

	// Click events arrive here
	"click": function(evt) {
		//Nothing so far
	}
});

// Attaching events to the board
Util.events(board, {
	// add a candy to the board
	"add": function(e) {
		// Your code here
	},

	// move a candy from location 1 to location 2
	"move": function(e) {
		// Your code here
	},

	// remove a candy from the board
	"remove": function(e) {
		// Your code here
	},

	// update the score
	"scoreUpdate": function(e) {
		// Your code here. To be implemented in PS3.
	},
});

