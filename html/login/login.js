var Checking = false;
var isRegisterMode = false;
var usernameTimeout = null;

function setCookie(name,value) {
  const exipre = new Date();
  exipre.setTime(exipre.getTime() + (14*24*60*60*1000));
  document.cookie = name + "=" + value + ";" + ("expires="+ exipre.toUTCString()) + ";path=/";
};

function toggleMode() {
  isRegisterMode = !isRegisterMode;
  const title = document.getElementById('title');
  const btn = document.getElementById('ActionBtn');
  const toggleMsg = document.getElementById('toggle-msg');
  const toggleBtn = document.getElementById('toggle-btn');
  const confirmGroup = document.getElementById('confirm-pwd-group');
  const notif = document.getElementById('notification');
  const card = document.getElementById('login-card');
  
  notif.innerHTML = "";
  
  card.style.opacity = '0';
  
  setTimeout(() => {
    if (isRegisterMode) {
      title.innerText = "Sign Up";
      btn.innerText = "Create Account";
      toggleMsg.innerText = "Already have an account?";
      toggleBtn.innerText = "Sign in";
      confirmGroup.style.display = "block";
    } else {
      title.innerText = "Log In";
      btn.innerText = "Sign in";
      toggleMsg.innerText = "Don't have an account?";
      toggleBtn.innerText = "Sign up";
      confirmGroup.style.display = "none";
    }

    card.style.opacity = '1';
  }, 200);
}

function checkUsernameAvailability() {
    if (!isRegisterMode) return;
    const loginInput = document.getElementById('un');
    const login = loginInput.value;
    const notif = document.getElementById('notification');
    
    if (login.length < 3) {
        loginInput.classList.remove('valid', 'invalid');
        return;
    }

    fetch(`${window.location.origin}/check_username`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ login: login })
    })
    .then(r => r.json())
    .then(data => {
        if (!data.available) {
            loginInput.classList.remove('valid');
            loginInput.classList.add('invalid');
            notif.style.color = "#e15555";
            notif.innerHTML = "Username already taken";
        } else {
            loginInput.classList.remove('invalid');
            loginInput.classList.add('valid');
            if (notif.innerHTML === "Username already taken") notif.innerHTML = "";
        }
    });
}

const pwdInput = document.getElementById('pwd');
const reqBox = document.getElementById('password-requirements');

function updateRequirements(val) {
    const reqLen = document.getElementById('req-len');
    
    let validCount = 0;
    
    if (val.length >= 8) {
        reqLen.classList.add('valid');
        reqLen.classList.remove('invalid');
        validCount++;
    } else {
        reqLen.classList.remove('valid');
        reqLen.classList.add('invalid');
    }
    
    return validCount === 1;
}

pwdInput.addEventListener('focus', () => {
    if (isRegisterMode) {
        const allValid = updateRequirements(pwdInput.value);
        if (!allValid) reqBox.style.display = 'block';
    }
});

pwdInput.addEventListener('blur', () => {
    reqBox.style.display = 'none';
});

pwdInput.addEventListener('input', () => {
    if (!isRegisterMode) return;
    const allValid = updateRequirements(pwdInput.value);
    if (allValid) {
        reqBox.style.display = 'none';
    } else {
        reqBox.style.display = 'block';
    }
});

function setupPasswordToggle(toggleId, inputId) {
    const toggleBtn = document.getElementById(toggleId);
    const input = document.getElementById(inputId);
    
    toggleBtn.addEventListener('click', (e) => {
        e.preventDefault();
        const type = input.getAttribute('type') === 'password' ? 'text' : 'password';
        input.setAttribute('type', type);
        
        if (type === 'text') {
            toggleBtn.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>';
        } else {
            toggleBtn.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>';
        }
    });
}

setupPasswordToggle('toggle-pwd', 'pwd');
setupPasswordToggle('toggle-pwd-confirm', 'pwd-confirm');

document.getElementById('un').addEventListener('input', function() {
    if (usernameTimeout) clearTimeout(usernameTimeout);
    usernameTimeout = setTimeout(checkUsernameAvailability, 500);
});

function Submit() {
  if (Checking) return;
  
  const login = document.getElementById('un').value;
  const password = document.getElementById('pwd').value;
  const notif = document.getElementById('notification');
  const btn = document.getElementById("ActionBtn");
  
  if (!login || !password) {
    notif.innerHTML = "Please fill in all fields";
    return;
  }
  
  if (isRegisterMode) {
    const confirm = document.getElementById('pwd-confirm').value;
    if (password !== confirm) {
      notif.innerHTML = "Passwords do not match";
      return;
    }
    if (password.length < 8) {
      notif.innerHTML = "Password must be at least 8 characters";
      return;
    }
  }
  
  Checking = true;
  notif.innerHTML = "";
  btn.style.cursor = "wait";
  btn.disabled = true;
  
  const csrf = document.getElementById('csrf').getAttribute("value");
  const payload = {
    login: login,
    password: password,
  };
  
  const endpoint = isRegisterMode ? '/register' : '/login';
  
  fetch(`${window.location.origin}${endpoint}`, {
    method: 'POST',
    headers: {
      Accept: 'application.json',
      "Content-Type": "application/json",
      "csrf": csrf
    },
    body: JSON.stringify(payload)
  })
  .then((response) => response.json())
  .then((data) => {
    Checking = false;
    btn.style.cursor = "pointer";
    btn.disabled = false;
    
    if (isRegisterMode) {
      if (data["status"] === "OK") {
        notif.style.color = "green";
        notif.innerHTML = "Account created! Logging in...";
        setTimeout(() => {
            isRegisterMode = false;
            Submit();
        }, 1000);
      } else {
        notif.style.color = "#e15555";
        notif.innerHTML = data["status"] || "Registration failed";
      }
    } else {
      if (data["token"] && data["token"] != "none") {
        setCookie("login", login);
        setCookie("uid", data["uid"]);
        setCookie("token", data["token"]);
        window.location.replace(`${window.location.origin}/user`);
      } else {
        notif.style.color = "#e15555";
        notif.innerHTML = "Wrong username or password";
      }
    }
  })
  .catch(err => {
    Checking = false;
    btn.style.cursor = "pointer";
    btn.disabled = false;
    notif.style.color = "#e15555";
    notif.innerHTML = "Connection error";
  });
};

document.onkeydown = async function(event) {
  if (event.keyCode == 13) {
    const activeId = document.activeElement.getAttribute("id");
    if (activeId == "pwd" || activeId == "un" || activeId == "pwd-confirm") {
      Submit();
    }
  }
};

document.getElementById("ActionBtn").onclick = function() {Submit()};