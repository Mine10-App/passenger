// Toggle password visibility
document.getElementById('togglePassword').addEventListener('click', function() {
  const passwordInput = document.getElementById('password');
  const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
  passwordInput.setAttribute('type', type);
  this.textContent = type === 'password' ? 'Show' : 'Hide';
});

// Allow login with Enter key
document.getElementById('password').addEventListener('keypress', function(e) {
  if (e.key === 'Enter') {
    login();
  }
});

function login() {
  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value.trim();
  const errorMsg = document.getElementById('errorMsg');
  const loginContainer = document.querySelector('.login-container');

  // Clear previous error
  errorMsg.style.display = 'none';
  errorMsg.textContent = '';
  loginContainer.classList.remove('shake');

  // Validate inputs
  if (!username || !password) {
    showError("Please enter both username and password");
    return;
  }

  // Find user in user.js
  const user = users.find(u => u.username === username);
  if (!user) {
    showError("Invalid username or password");
    return;
  }

  // Compare hashed password
  const hashedInput = CryptoJS.SHA256(password).toString();
  if (user.passwordHash !== hashedInput) {
    showError("Invalid username or password");
    return;
  }

  // Save logged-in user and level in localStorage
  const loggedInUser = {
    username: user.username,
    name: user.name,
    Level: user.Level
  };
  localStorage.setItem('loggedInUser', JSON.stringify(loggedInUser));

  // Show success message and redirect
  errorMsg.style.display = 'block';
  errorMsg.textContent = 'Login successful! Redirecting...';
  errorMsg.style.color = 'var(--success-color)';
  errorMsg.style.backgroundColor = 'rgba(40, 167, 69, 0.1)';
  errorMsg.style.borderLeftColor = 'var(--success-color)';

  setTimeout(() => {
    window.location.href = 'dashboard.html';
  }, 1000);
}

function showError(message) {
  const errorMsg = document.getElementById('errorMsg');
  const loginContainer = document.querySelector('.login-container');

  errorMsg.textContent = message;
  errorMsg.style.display = 'block';
  errorMsg.style.color = 'var(--error-color)';
  errorMsg.style.backgroundColor = 'rgba(220, 53, 69, 0.1)';
  errorMsg.style.borderLeftColor = 'var(--error-color)';

  // Add shake animation
  loginContainer.classList.add('shake');
  setTimeout(() => {
    loginContainer.classList.remove('shake');
  }, 500);
}
