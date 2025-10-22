var Checking = false;
function setCookie(name,value) {
  const exipre = new Date();
  exipre.setTime(exipre.getTime() + (14*24*60*60*1000));
  document.cookie = name + "=" + value + ";" + ("expires="+ exipre.toUTCString()) + ";path=/";
};
function Login() {
  if (Checking!=true) {
    Checking = true;
    document.getElementById('notification').innerHTML = "";
    document.getElementById("LoginButton").style.cursor = "wait";
    var login = document.getElementById('un').value;
    var password = document.getElementById('pwd').value;
    var sec = document.getElementById('sec');
    var payload = {
      login: login,
      password: password,
      key: sec.getAttribute("key"),
      solution: sec.getAttribute("solution")-1
    };
    fetch(`${window.location.origin}/login`, {
      method: 'POST',
      headers: {
        Accept: 'application.json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    })
    .then((response) => response.json())
    .then((data) => {
      Checking = false;
      if (data["token"]!="none") {
        setCookie("login", login);
        setCookie("uid", data["uid"]);
        setCookie("token", data["token"]);
        window.location.replace(`${window.location.origin}/user`);
      } else {
        document.getElementById('notification').innerHTML = "Wrong username or password";
        document.getElementById("LoginButton").style.cursor = "pointer";
      };
    })
  }
};

document.onkeydown = async function(event) {
  if (event.keyCode == 13) {
    if (document.activeElement.getAttribute("id") == "pwd" || document.activeElement.getAttribute("id") == "un") {
      Login();
    }
  }
};
document.getElementById("LoginButton").onclick = function() {Login()};