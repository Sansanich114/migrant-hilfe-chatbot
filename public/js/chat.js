document.getElementById("sendBtn").addEventListener("click", function() {
  var input = document.getElementById("chatInput");
  var message = input.value;
  if(message.trim() !== "") {
    var container = document.getElementById("chatContainer");
    var div = document.createElement("div");
    div.textContent = message;
    container.appendChild(div);
    input.value = "";
  }
});
