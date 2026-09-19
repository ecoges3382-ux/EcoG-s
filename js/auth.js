// ---- Authentification ----
const VALID_USERNAME = "Mèdécon";
const VALID_PASSWORD = "Mèdécon";

function attemptLogin(){
  const u = document.getElementById('login-username').value.trim();
  const p = document.getElementById('login-password').value.trim();
  const err = document.getElementById('login-error');
  if(u !== VALID_USERNAME || p !== VALID_PASSWORD){
    err.style.display = 'block';
    return;
  }
  err.style.display = 'none';
  document.getElementById('login-brand').style.display = 'none';
  document.getElementById('login-step-credentials').style.display = 'none';
  document.getElementById('login-step-role').style.display = 'block';
}
window.attemptLogin = attemptLogin;

function backToCredentials(){
  document.getElementById('login-brand').style.display = 'block';
  document.getElementById('login-step-role').style.display = 'none';
  document.getElementById('login-step-credentials').style.display = 'block';
}
window.backToCredentials = backToCredentials;

function selectLoginRole(role){
  currentRole = role;
  document.getElementById('role-tag-top').textContent = ROLES[role].label;
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('app').style.display = 'flex';
  document.body.classList.add('app-mode');
  nav('dashboard');
}
window.selectLoginRole = selectLoginRole;

function logout(){
  document.body.classList.remove('app-mode');
  document.getElementById('app').style.display = 'none';
  document.getElementById('login-screen').style.display = 'flex';
  document.getElementById('login-brand').style.display = 'block';
  document.getElementById('login-step-role').style.display = 'none';
  document.getElementById('login-step-credentials').style.display = 'block';
  document.getElementById('login-username').value = '';
  document.getElementById('login-password').value = '';
}
window.logout = logout;
