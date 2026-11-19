/**
 * WatchX - Authentication & Netflix-Style Profiles Controller
 * Manages User Accounts, Google OAuth, Profile Switching,
 * 4-Digit Secure Profile PINs, and Avatar Customization.
 */

import { dbClient, DEFAULT_AVATARS } from './supabase-client.js?v=20';

class AuthProfileManager {
  constructor() {
    this.activeProfile = null;
    this.profilesList = [];
    this.isManageMode = false;
    this.pendingPinProfile = null;
    this.pinInputs = [];
    this.pinCountdownTimer = null;

    // DOM Elements
    this.profilesScreen = null;
    this.profilesContainer = null;
    this.manageBtn = null;
    this.pinModal = null;
    this.authModal = null;
    this.profileEditModal = null;

    this.onProfileChangeCallbacks = [];
  }

  async init() {
    this.bindDOMElements();
    this.setupEventListeners();
    await this.loadProfiles();

    // Check if an active profile was previously saved
    const savedProfileId = localStorage.getItem('watchx_active_profile_id');
    if (savedProfileId && this.profilesList.length > 0) {
      const match = this.profilesList.find(p => p.id === savedProfileId);
      if (match) {
        this.setActiveProfile(match, false);
      } else {
        this.showProfilesScreen();
      }
    } else {
      this.showProfilesScreen();
    }
  }

  bindDOMElements() {
    this.profilesScreen = document.getElementById('profiles-screen');
    this.profilesContainer = document.getElementById('profiles-grid');
    this.manageBtn = document.getElementById('manage-profiles-btn');
    this.pinModal = document.getElementById('pin-entry-modal');
    this.authModal = document.getElementById('auth-modal');
    this.profileEditModal = document.getElementById('profile-edit-modal');
    this.pinInputs = Array.from(document.querySelectorAll('.pin-digit-input'));
  }

  setupEventListeners() {
    // Manage Profiles Button Toggle
    if (this.manageBtn) {
      this.manageBtn.addEventListener('click', () => {
        this.isManageMode = !this.isManageMode;
        this.manageBtn.textContent = this.isManageMode ? 'Done' : 'Manage Profiles';
        this.manageBtn.classList.toggle('active-mode', this.isManageMode);
        this.renderProfiles();
      });
    }

    // Add Profile Button on "Who's Watching?"
    const addProfileBtn = document.getElementById('add-profile-btn');
    if (addProfileBtn) {
      addProfileBtn.addEventListener('click', () => {
        this.openProfileEditModal(null);
      });
    }

    // PIN Input Handling
    this.setupPinInputs();

    // Virtual Keypad in PIN modal
    const keypadBtns = document.querySelectorAll('.pin-key-btn');
    keypadBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const val = btn.dataset.key;
        this.handleKeypadPress(val);
      });
    });

    // Close PIN Modal
    const pinCloseBtn = document.getElementById('pin-modal-close');
    if (pinCloseBtn) {
      pinCloseBtn.addEventListener('click', () => this.closePinModal());
    }

    // Header Profile Dropdown Trigger
    const profileAvatarBtn = document.getElementById('header-profile-btn');
    const profileDropdown = document.getElementById('profile-dropdown-menu');
    if (profileAvatarBtn && profileDropdown) {
      profileAvatarBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        profileDropdown.classList.toggle('active');
      });

      document.addEventListener('click', (e) => {
        if (!profileDropdown.contains(e.target) && !profileAvatarBtn.contains(e.target)) {
          profileDropdown.classList.remove('active');
        }
      });
    }

    // Switch Profile Menu Item
    const switchProfileBtn = document.getElementById('menu-switch-profile');
    if (switchProfileBtn) {
      switchProfileBtn.addEventListener('click', () => {
        if (profileDropdown) profileDropdown.classList.remove('active');
        this.showProfilesScreen();
      });
    }

    // Manage Profiles Menu Item
    const menuManageProfiles = document.getElementById('menu-manage-profiles');
    if (menuManageProfiles) {
      menuManageProfiles.addEventListener('click', () => {
        if (profileDropdown) profileDropdown.classList.remove('active');
        this.isManageMode = true;
        if (this.manageBtn) {
          this.manageBtn.textContent = 'Done';
          this.manageBtn.classList.add('active-mode');
        }
        this.showProfilesScreen();
      });
    }

    // Auth Modal Handlers
    this.setupAuthModal();
  }

  // ==========================================================================
  // Profile Loading & Rendering
  // ==========================================================================
  async loadProfiles() {
    const user = dbClient.getCurrentUser();
    this.profilesList = await dbClient.getProfiles(user?.id);
    this.renderProfiles();
  }

  renderProfiles() {
    if (!this.profilesContainer) return;
    this.profilesContainer.innerHTML = '';

    this.profilesList.forEach(profile => {
      const card = document.createElement('div');
      card.className = `profile-card ${this.isManageMode ? 'manage-mode' : ''}`;
      card.dataset.id = profile.id;

      card.innerHTML = `
        <div class="profile-avatar-wrap">
          <img class="profile-avatar-img" src="${profile.avatar_url}" alt="${profile.name}">
          ${profile.pin_enabled ? '<div class="profile-pin-lock" title="PIN Protected"><i class="fas fa-lock"></i></div>' : ''}
          ${profile.is_kids ? '<div class="profile-kids-badge">KIDS</div>' : ''}
          ${this.isManageMode ? '<div class="profile-edit-overlay"><i class="fas fa-pencil"></i></div>' : ''}
        </div>
        <span class="profile-card-name">${profile.name}</span>
      `;

      card.addEventListener('click', () => {
        if (this.isManageMode) {
          this.openProfileEditModal(profile);
        } else {
          this.selectProfile(profile);
        }
      });

      this.profilesContainer.appendChild(card);
    });

    // Add Profile Card
    if (this.profilesList.length < 5) {
      const addCard = document.createElement('div');
      addCard.className = 'profile-card add-profile-card';
      addCard.innerHTML = `
        <div class="profile-avatar-wrap add-wrap">
          <i class="fas fa-plus"></i>
        </div>
        <span class="profile-card-name">Add Profile</span>
      `;
      addCard.addEventListener('click', () => this.openProfileEditModal(null));
      this.profilesContainer.appendChild(addCard);
    }
  }

  showProfilesScreen() {
    if (this.profilesScreen) {
      this.profilesScreen.classList.add('active');
      this.profilesScreen.style.display = 'flex';
      this.renderProfiles();
    }
  }

  hideProfilesScreen() {
    if (this.profilesScreen) {
      this.profilesScreen.classList.remove('active');
      this.profilesScreen.style.display = 'none';
    }
  }

  async selectProfile(profile) {
    if (profile.pin_enabled && profile.pin_hash) {
      // Prompt for PIN
      this.openPinModal(profile);
    } else {
      this.setActiveProfile(profile, true);
    }
  }

  setActiveProfile(profile, triggerEvents = true) {
    this.activeProfile = profile;
    localStorage.setItem('watchx_active_profile_id', profile.id);
    this.hideProfilesScreen();

    // Update Header Avatar & Name
    const headerAvatar = document.querySelector('.user-avatar');
    if (headerAvatar) headerAvatar.src = profile.avatar_url;

    const dropdownName = document.getElementById('dropdown-profile-name');
    if (dropdownName) dropdownName.textContent = profile.name;

    const dropdownAvatar = document.getElementById('dropdown-profile-avatar');
    if (dropdownAvatar) dropdownAvatar.src = profile.avatar_url;

    if (triggerEvents) {
      this.notifyProfileChanged(profile);
    }
  }

  onProfileChanged(callback) {
    this.onProfileChangeCallbacks.push(callback);
  }

  notifyProfileChanged(profile) {
    this.onProfileChangeCallbacks.forEach(cb => {
      try { cb(profile); } catch (e) { console.error(e); }
    });
    window.dispatchEvent(new CustomEvent('watchx:profile-changed', { detail: profile }));
  }

  getActiveProfile() {
    return this.activeProfile || this.profilesList[0] || null;
  }

  // ==========================================================================
  // Cryptographic Profile PIN Entry System
  // ==========================================================================
  openPinModal(profile) {
    this.pendingPinProfile = profile;
    if (!this.pinModal) return;

    // Reset PIN inputs
    this.pinInputs.forEach(inp => { inp.value = ''; });
    const nameEl = document.getElementById('pin-modal-profile-name');
    if (nameEl) nameEl.textContent = profile.name;

    const avatarEl = document.getElementById('pin-modal-profile-avatar');
    if (avatarEl) avatarEl.src = profile.avatar_url;

    const errorEl = document.getElementById('pin-modal-error');
    if (errorEl) {
      errorEl.textContent = '';
      errorEl.style.display = 'none';
    }

    this.pinModal.classList.add('active');
    setTimeout(() => {
      if (this.pinInputs[0]) this.pinInputs[0].focus();
    }, 150);
  }

  closePinModal() {
    if (this.pinModal) this.pinModal.classList.remove('active');
    this.pendingPinProfile = null;
    if (this.pinCountdownTimer) clearInterval(this.pinCountdownTimer);
  }

  setupPinInputs() {
    this.pinInputs.forEach((input, idx) => {
      input.addEventListener('input', (e) => {
        const val = e.target.value.replace(/\D/g, '');
        e.target.value = val ? val[val.length - 1] : '';

        if (e.target.value && idx < this.pinInputs.length - 1) {
          this.pinInputs[idx + 1].focus();
        }

        // Check if all 4 digits entered
        this.checkPinCompletion();
      });

      input.addEventListener('keydown', (e) => {
        if (e.key === 'Backspace' && !input.value && idx > 0) {
          this.pinInputs[idx - 1].focus();
        }
      });
    });
  }

  handleKeypadPress(key) {
    if (key === 'clear') {
      this.pinInputs.forEach(i => i.value = '');
      if (this.pinInputs[0]) this.pinInputs[0].focus();
      return;
    }

    if (key === 'back') {
      for (let i = this.pinInputs.length - 1; i >= 0; i--) {
        if (this.pinInputs[i].value) {
          this.pinInputs[i].value = '';
          this.pinInputs[i].focus();
          break;
        }
      }
      return;
    }

    // Number key
    for (let i = 0; i < this.pinInputs.length; i++) {
      if (!this.pinInputs[i].value) {
        this.pinInputs[i].value = key;
        if (i < this.pinInputs.length - 1) {
          this.pinInputs[i + 1].focus();
        }
        break;
      }
    }
    this.checkPinCompletion();
  }

  async checkPinCompletion() {
    const fullPin = this.pinInputs.map(i => i.value).join('');
    if (fullPin.length === 4 && this.pendingPinProfile) {
      const res = await dbClient.verifyProfilePin(this.pendingPinProfile, fullPin);
      if (res.success) {
        const target = this.pendingPinProfile;
        this.closePinModal();
        this.setActiveProfile(target, true);
      } else {
        this.showPinError(res);
      }
    }
  }

  showPinError(res) {
    const box = document.querySelector('.pin-input-group');
    if (box) {
      box.classList.add('pin-shake');
      setTimeout(() => box.classList.remove('pin-shake'), 600);
    }

    const errorEl = document.getElementById('pin-modal-error');
    if (errorEl) {
      errorEl.textContent = res.error || 'Incorrect PIN. Try again.';
      errorEl.style.display = 'block';
    }

    this.pinInputs.forEach(inp => inp.value = '');
    if (this.pinInputs[0]) this.pinInputs[0].focus();

    if (res.locked && res.waitSeconds) {
      let remaining = res.waitSeconds;
      if (this.pinCountdownTimer) clearInterval(this.pinCountdownTimer);
      this.pinCountdownTimer = setInterval(() => {
        remaining--;
        if (remaining <= 0) {
          clearInterval(this.pinCountdownTimer);
          if (errorEl) {
            errorEl.textContent = 'Lockout expired. You may now re-enter your PIN.';
          }
        } else {
          if (errorEl) {
            errorEl.textContent = `Too many incorrect attempts. Locked for ${remaining}s...`;
          }
        }
      }, 1000);
    }
  }

  // ==========================================================================
  // Profile Editor Modal (Create, Edit, PIN Toggle, Avatar Picker)
  // ==========================================================================
  openProfileEditModal(profile = null) {
    if (!this.profileEditModal) return;
    const isNew = !profile;

    const titleEl = document.getElementById('profile-edit-title');
    if (titleEl) titleEl.textContent = isNew ? 'Add Profile' : 'Edit Profile';

    const nameInput = document.getElementById('edit-profile-name');
    if (nameInput) nameInput.value = profile ? profile.name : '';

    const kidsCheckbox = document.getElementById('edit-profile-kids');
    if (kidsCheckbox) kidsCheckbox.checked = Boolean(profile?.is_kids);

    const deleteBtn = document.getElementById('edit-profile-delete-btn');
    if (deleteBtn) {
      deleteBtn.style.display = (isNew || this.profilesList.length <= 1) ? 'none' : 'block';
      deleteBtn.onclick = async () => {
        if (confirm(`Are you sure you want to delete profile "${profile.name}"?`)) {
          await dbClient.deleteProfile(profile.id);
          this.closeProfileEditModal();
          await this.loadProfiles();
        }
      };
    }

    // Avatar preview
    let selectedAvatar = profile ? profile.avatar_url : DEFAULT_AVATARS[0];
    const previewImg = document.getElementById('edit-avatar-preview');
    if (previewImg) previewImg.src = selectedAvatar;

    // Render Avatar Picker Grid
    const avatarGrid = document.getElementById('avatar-picker-grid');
    if (avatarGrid) {
      avatarGrid.innerHTML = DEFAULT_AVATARS.map(url => `
        <div class="avatar-option ${url === selectedAvatar ? 'selected' : ''}" data-url="${url}">
          <img src="${url}" alt="Avatar">
        </div>
      `).join('');

      avatarGrid.querySelectorAll('.avatar-option').forEach(opt => {
        opt.addEventListener('click', () => {
          avatarGrid.querySelectorAll('.avatar-option').forEach(o => o.classList.remove('selected'));
          opt.classList.add('selected');
          selectedAvatar = opt.dataset.url;
          if (previewImg) previewImg.src = selectedAvatar;
        });
      });
    }

    // Custom Avatar File Upload
    const avatarFileInput = document.getElementById('avatar-file-upload');
    if (avatarFileInput) {
      avatarFileInput.value = '';
      avatarFileInput.onchange = (e) => {
        const file = e.target.files[0];
        if (file) {
          if (file.size > 2 * 1024 * 1024) {
            alert('Avatar image must be under 2MB.');
            return;
          }
          const reader = new FileReader();
          reader.onload = (re) => {
            selectedAvatar = re.target.result;
            if (previewImg) previewImg.src = selectedAvatar;
          };
          reader.readAsDataURL(file);
        }
      };
    }

    // PIN Settings in Edit Modal
    const pinCheckbox = document.getElementById('edit-pin-toggle');
    const pinGroup = document.getElementById('edit-pin-group');
    const pinInput = document.getElementById('edit-profile-pin');
    if (pinCheckbox && pinGroup && pinInput) {
      pinCheckbox.checked = Boolean(profile?.pin_enabled);
      pinGroup.style.display = pinCheckbox.checked ? 'block' : 'none';
      pinInput.value = '';

      pinCheckbox.onchange = () => {
        pinGroup.style.display = pinCheckbox.checked ? 'block' : 'none';
      };
    }

    // Save Button
    const saveBtn = document.getElementById('edit-profile-save-btn');
    if (saveBtn) {
      saveBtn.onclick = async () => {
        const name = nameInput.value.trim();
        if (!name) {
          alert('Please enter a profile name.');
          return;
        }

        const isKids = kidsCheckbox.checked;
        const pinEnabled = pinCheckbox.checked;
        const newPinVal = pinInput.value.replace(/\D/g, '');

        if (pinEnabled && (!profile?.pin_enabled || newPinVal) && newPinVal.length !== 4) {
          alert('Profile PIN must be exactly 4 digits.');
          return;
        }

        if (isNew) {
          const user = dbClient.getCurrentUser();
          await dbClient.createProfile(user?.id, {
            name,
            avatar_url: selectedAvatar,
            is_kids: isKids,
            pin: pinEnabled ? newPinVal : null
          });
        } else {
          const updates = {
            name,
            avatar_url: selectedAvatar,
            is_kids: isKids
          };
          if (!pinEnabled) {
            updates.pin_enabled = false;
            updates.pin_hash = null;
            updates.pin_salt = null;
          } else if (newPinVal && newPinVal.length === 4) {
            const salt = await import('./supabase-client.js?v=20').then(m => m.generateSalt());
            const hash = await import('./supabase-client.js?v=20').then(m => m.hashPin(newPinVal, salt));
            updates.pin_enabled = true;
            updates.pin_salt = salt;
            updates.pin_hash = hash;
          }
          await dbClient.updateProfile(profile.id, updates);
        }

        this.closeProfileEditModal();
        await this.loadProfiles();
      };
    }

    // Close Button
    const closeBtn = document.getElementById('edit-profile-close-btn');
    if (closeBtn) closeBtn.onclick = () => this.closeProfileEditModal();

    const cancelBtn = document.getElementById('edit-profile-cancel-btn');
    if (cancelBtn) cancelBtn.onclick = () => this.closeProfileEditModal();

    this.profileEditModal.classList.add('active');
  }

  closeProfileEditModal() {
    if (this.profileEditModal) this.profileEditModal.classList.remove('active');
  }

  // ==========================================================================
  // Auth Modal (Sign In / Sign Up / Forgot Password / Google OAuth)
  // ==========================================================================
  setupAuthModal() {
    const openAuthBtn = document.getElementById('menu-account-settings');
    if (openAuthBtn) {
      openAuthBtn.addEventListener('click', () => {
        const profileDropdown = document.getElementById('profile-dropdown-menu');
        if (profileDropdown) profileDropdown.classList.remove('active');
        window.dispatchEvent(new CustomEvent('watchx:navigate', { detail: 'settings' }));
      });
    }

    // Sign Out Menu Item
    const signOutBtn = document.getElementById('menu-sign-out');
    if (signOutBtn) {
      signOutBtn.addEventListener('click', async () => {
        if (confirm('Are you sure you want to sign out of WatchX?')) {
          await dbClient.signOut();
          location.reload();
        }
      });
    }

    // Google Sign-In Buttons
    const googleBtns = document.querySelectorAll('.btn-google-auth');
    googleBtns.forEach(btn => {
      btn.addEventListener('click', async () => {
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Connecting to Google...';
        try {
          await dbClient.signInWithGoogle();
          if (this.authModal) this.authModal.classList.remove('active');
          location.reload();
        } catch (err) {
          alert('Google Authentication error: ' + err.message);
          btn.disabled = false;
          btn.innerHTML = '<i class="fab fa-google"></i> Continue with Google';
        }
      });
    });

    // Email Auth Form
    const authForm = document.getElementById('auth-form');
    if (authForm) {
      authForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const mode = authForm.dataset.mode || 'signin';
        const email = document.getElementById('auth-email').value;
        const password = document.getElementById('auth-password').value;
        const name = document.getElementById('auth-name') ? document.getElementById('auth-name').value : '';
        const submitBtn = authForm.querySelector('.btn-auth-submit');
        const errorEl = document.getElementById('auth-error-msg');

        if (errorEl) { errorEl.textContent = ''; errorEl.style.display = 'none'; }
        if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Processing...'; }

        try {
          if (mode === 'signup') {
            await dbClient.signUp(email, password, name);
          } else {
            await dbClient.signIn(email, password);
          }
          if (this.authModal) this.authModal.classList.remove('active');
          location.reload();
        } catch (err) {
          if (errorEl) {
            errorEl.textContent = err.message;
            errorEl.style.display = 'block';
          }
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = mode === 'signup' ? 'Create Account' : 'Sign In';
          }
        }
      });
    }

    // Toggle between Sign In & Sign Up
    const authToggleTabBtns = document.querySelectorAll('.auth-tab-btn');
    authToggleTabBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        authToggleTabBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const mode = btn.dataset.mode;
        const form = document.getElementById('auth-form');
        if (form) form.dataset.mode = mode;

        const nameGroup = document.getElementById('auth-name-group');
        if (nameGroup) nameGroup.style.display = mode === 'signup' ? 'block' : 'none';

        const submitBtn = document.querySelector('.btn-auth-submit');
        if (submitBtn) submitBtn.textContent = mode === 'signup' ? 'Create Account' : 'Sign In';

        const modalTitle = document.getElementById('auth-modal-title');
        if (modalTitle) modalTitle.textContent = mode === 'signup' ? 'Join WatchX Cinema' : 'Sign In to WatchX';
      });
    });

    // Close Auth Modal
    const authCloseBtn = document.getElementById('auth-modal-close');
    if (authCloseBtn) {
      authCloseBtn.addEventListener('click', () => {
        if (this.authModal) this.authModal.classList.remove('active');
      });
    }
  }

  openAuthModal(initialMode = 'signin') {
    if (!this.authModal) return;
    const tab = document.querySelector(`.auth-tab-btn[data-mode="${initialMode}"]`);
    if (tab) tab.click();
    this.authModal.classList.add('active');
  }
}

export const authManager = new AuthProfileManager();
