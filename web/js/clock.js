var myTimer = setInterval(setClock,1000);
function setClock(){	
	   document.getElementById("clock").innerHTML=new Date().toLocaleTimeString();}