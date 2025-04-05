// Bluesky Follower Checker
// A web-based tool to check who doesn't follow you back on Bluesky

// Language and localization
let currentLanguage = 'en';

// Detect browser language
function detectBrowserLanguage() {
    const browserLang = navigator.language || navigator.userLanguage;
    if (browserLang.startsWith('tr')) {
        return 'tr';
    }
    return 'en'; // Default to English
}

// Set initial language based on browser
currentLanguage = detectBrowserLanguage();

// Get translated text
function __(key, replacements = {}) {
    let text = languages[currentLanguage][key] || languages.en[key];
    
    // Replace placeholders with values
    Object.keys(replacements).forEach(placeholder => {
        text = text.replace(new RegExp(`\\{${placeholder}\\}`, 'g'), replacements[placeholder]);
    });
    
    return text;
}

// Update all UI text based on selected language
function updateUILanguage() {
    // Update all text elements with data-lang attribute
    document.querySelectorAll('[data-lang]').forEach(element => {
        const key = element.getAttribute('data-lang');
        // Use innerHTML instead of textContent to properly handle HTML elements like anchors
        element.innerHTML = __(key);
    });

    // Update placeholders
    document.querySelectorAll('[data-lang-placeholder]').forEach(element => {
        const key = element.getAttribute('data-lang-placeholder');
        element.placeholder = __(key);
    });

    // Update language selector
    document.getElementById('languageSelector').value = currentLanguage;
    
    // Reload UI if already logged in
    if (state.session) {
        updateUserInfo();
        updateStats();
        populateNonFollowersTable();
    }
}

// Constants
const BLUESKY_API = 'https://bsky.social';
const RATE_LIMITS = {
    // Direct operation limits
    UNFOLLOW_DELAY_MS: 1000, // 1 second between unfollows (can be lower now based on Bluesky's limits)
    PROFILE_INFO_DELAY_MS: 25, // 25ms between profile info requests (less conservative)
    
    // Bluesky's documented rate limits (as of April 2025)
    MAX_UNFOLLOWS_PER_MINUTE: 60, // Can be higher based on 5,000 points/hour limit for DELETE ops (1 point each)
    MAX_UNFOLLOWS_PER_HOUR: 3000, // Value lower than the 5,000 points/hour to be safe
    MAX_UNFOLLOWS_PER_DAY: 30000, // Value lower than the 35,000 points/day to be safe
    MAX_API_REQUESTS: 2500 // 3000 per 5 minutes, using 2500 to be conservative
};

// LocalStorage keys
const STORAGE_KEYS = {
    WHITELIST: 'blueskyFollowerCheckerWhitelist'
};

// State management
const state = {
    session: null,
    follows: [],
    followers: [],
    nonFollowBacks: [],
    whitelist: new Set(), // Whitelist of handles
    selectedIndices: new Set()
};

// DOM Elements
const elements = {
    // Login section
    loginSection: document.getElementById('loginSection'),
    loginButton: document.getElementById('loginButton'),
    identifier: document.getElementById('identifier'),
    password: document.getElementById('password'),
    
    // Results section
    resultsSection: document.getElementById('resultsSection'),
    userInfo: document.getElementById('userInfo'),
    statsContainer: document.getElementById('statsContainer'),
    nonFollowersTable: document.getElementById('nonFollowersTable'),
    selectAllCheckbox: document.getElementById('selectAllCheckbox'),
    
    // Follow counts loading
    loadingFollowCounts: document.getElementById('loadingFollowCounts'),
    followCountsProgress: document.getElementById('followCountsProgress'),
    followCountsProgressBar: document.getElementById('followCountsProgressBar'),
    
    // Action buttons
    unfollowButton: document.getElementById('unfollowButton'),
    createListButton: document.getElementById('createListButton'),
    bothButton: document.getElementById('bothButton'),
    
    // Action progress & results
    actionProgress: document.getElementById('actionProgress'),
    actionTitle: document.getElementById('actionTitle'),
    actionStatus: document.getElementById('actionStatus'),
    actionProgressBar: document.getElementById('actionProgressBar'),
    actionResults: document.getElementById('actionResults'),
    actionResultsContent: document.getElementById('actionResultsContent'),
    
    // Tabs
    tabButtons: document.querySelectorAll('.tab-button'),
    tabContents: document.querySelectorAll('.tab-content'),
    
    // Logout
    logoutContainer: document.getElementById('logoutContainer'),
    logoutButton: document.getElementById('logoutButton')
};

// Helper functions
function showElement(element) {
    element.classList.remove('hidden');
}

function hideElement(element) {
    element.classList.add('hidden');
}

function setProgressBar(progressBar, percent) {
    progressBar.style.width = `${percent}%`;
}

function showError(message) {
    alert(message);
}

// Helper functions for rate limiting and countdown
async function countdownTimer(seconds, messageKey, statusCallback) {
    // Create a promise that will resolve after the countdown is complete
    return new Promise((resolve) => {
        let remainingSeconds = seconds;
        
        // Update the status immediately with the initial countdown
        if (statusCallback) {
            statusCallback(__(messageKey, { seconds: remainingSeconds }));
        }
        
        // Create the interval to update the countdown every second
        const countdownInterval = setInterval(() => {
            remainingSeconds--;
            
            // Update the status with the new countdown
            if (statusCallback && remainingSeconds > 0) {
                statusCallback(__(messageKey, { seconds: remainingSeconds }));
            }
            
            // If countdown is complete, clear the interval and resolve the promise
            if (remainingSeconds <= 0) {
                clearInterval(countdownInterval);
                resolve();
            }
        }, 1000); // Update every 1 second
    });
}

// Minutes countdown version for longer waits
async function countdownTimerMinutes(minutes, messageKey, statusCallback) {
    const totalSeconds = minutes * 60;
    let remainingSeconds = totalSeconds;
    
    // Update the status immediately with the initial countdown
    if (statusCallback) {
        statusCallback(__(messageKey, { minutes }));
    }
    
    return new Promise((resolve) => {
        const countdownInterval = setInterval(() => {
            remainingSeconds--;
            
            // Calculate remaining minutes and seconds
            const remainingMinutes = Math.floor(remainingSeconds / 60);
            
            // Update status only once per minute to avoid too many updates
            if (remainingSeconds % 60 === 0 && statusCallback && remainingSeconds > 0) {
                statusCallback(__(messageKey, { minutes: remainingMinutes }));
            }
            
            // If countdown is complete, clear the interval and resolve the promise
            if (remainingSeconds <= 0) {
                clearInterval(countdownInterval);
                resolve();
            }
        }, 1000);
    });
}

// Whitelist functions
function loadWhitelist() {
    try {
        const whitelistStr = localStorage.getItem(STORAGE_KEYS.WHITELIST);
        if (!whitelistStr) return new Set();
        
        return new Set(JSON.parse(whitelistStr));
    } catch (e) {
        console.error('Failed to load whitelist', e);
        return new Set();
    }
}

function saveWhitelist(whitelist) {
    try {
        localStorage.setItem(STORAGE_KEYS.WHITELIST, JSON.stringify(Array.from(whitelist)));
    } catch (e) {
        console.error('Failed to save whitelist', e);
    }
}

// Tab functionality
elements.tabButtons.forEach(button => {
    button.addEventListener('click', () => {
        const tab = button.getAttribute('data-tab');
        
        // Update active tab button
        elements.tabButtons.forEach(btn => btn.classList.remove('active'));
        button.classList.add('active');
        
        // Update active tab content
        elements.tabContents.forEach(content => content.classList.remove('active'));
        const activeContent = tab === 'nonFollowers' ? 
            document.getElementById('nonFollowersTab') : 
            document.getElementById('actionsTab');
        activeContent.classList.add('active');
    });
});

// API interaction functions
async function loginToBluesky(identifier, password) {
    try {
        const response = await fetch(`${BLUESKY_API}/xrpc/com.atproto.server.createSession`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ identifier, password }),
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(`Login failed: ${error.message || "Unknown error"}`);
        }

        return await response.json();
    } catch (error) {
        console.error("Login failed:", error);
        throw new Error("Login failed. Please check your credentials.");
    }
}

async function fetchAllPages(endpoint, actor, dataKey) {
    if (!state.session) throw new Error("Not logged in");
    
    const results = [];
    let cursor = undefined;
    
    do {
        const url = new URL(`${BLUESKY_API}/xrpc/${endpoint}`);
        url.searchParams.append("actor", actor);
        
        if (cursor) {
            url.searchParams.append("cursor", cursor);
        }
        
        url.searchParams.append("limit", "100");

        const response = await fetch(url.toString(), {
            headers: { 
                "Authorization": `Bearer ${state.session.accessJwt}` 
            }
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(`API request failed: ${error.message || "Unknown error"}`);
        }

        const data = await response.json();
        results.push(...data[dataKey]);
        cursor = data.cursor;
    } while (cursor);
    
    return results;
}

// Modify getFollows() function to include follow URIs
async function getFollows() {
    if (!state.session) throw new Error("Not logged in");
    
    const follows = await fetchAllPages(
        "app.bsky.graph.getFollows", 
        state.session.did,
        "follows"
    );
    
    return follows.map(follow => ({
        handle: follow.handle,
        displayName: follow.displayName || follow.handle,
        did: follow.did,
        followUri: follow.viewer?.following // Store the follow URI
    }));
}

async function getFollowers() {
    if (!state.session) throw new Error("Not logged in");
    
    const followers = await fetchAllPages(
        "app.bsky.graph.getFollowers", 
        state.session.did,
        "followers"
    );
    
    return followers.map(follower => ({
        handle: follower.handle,
        displayName: follower.displayName || follower.handle,
        did: follower.did,
    }));
}

function findNonFollowBacks(follows, followers) {
    const followerHandles = new Set(followers.map(f => f.handle));
    return follows.filter(follow => !followerHandles.has(follow.handle));
}

async function getProfileInfo(did) {
    if (!state.session) throw new Error("Not logged in");
    
    try {
        const url = new URL(`${BLUESKY_API}/xrpc/app.bsky.actor.getProfile`);
        url.searchParams.append("actor", did);
        
        const response = await fetch(url.toString(), {
            headers: { 
                "Authorization": `Bearer ${state.session.accessJwt}` 
            }
        });

        if (!response.ok) {
            return { followsCount: 0 };
        }

        const data = await response.json();
        return { 
            followsCount: data.followsCount || 0
        };
    } catch (error) {
        console.error(`Error fetching profile for ${did}:`, error);
        return { followsCount: 0 };
    }
}

async function enrichWithProfileData(users, progressCallback) {
    for (let i = 0; i < users.length; i++) {
        const user = users[i];
        if (user.did) {
            try {
                const profile = await getProfileInfo(user.did);
                user.followsCount = profile.followsCount;
                
                // Report progress
                const progress = Math.round((i + 1) / users.length * 100);
                if (progressCallback) {
                    progressCallback(progress);
                }
                
                // Add a small delay to avoid hitting rate limits
                await new Promise(resolve => setTimeout(resolve, RATE_LIMITS.PROFILE_INFO_DELAY_MS));
            } catch (error) {
                // Continue with next user if there's an error
            }
        }
    }
    
    return users;
}

// Then simplify unfollowUser function
async function unfollowUser(did, followUri) {
    if (!state.session) throw new Error("Not logged in");
    if (!did) throw new Error("Invalid DID provided");
    if (!followUri) {
        console.error("Follow URI not provided");
        return false;
    }
    
    try {
        // Extract the rkey from the URI
        const parts = followUri.split('/');
        if (!parts || parts.length < 2) {
            console.error("Invalid follow URI format");
            return false;
        }
        
        const rkey = parts[parts.length - 1];
        
        // Delete the follow record using com.atproto.repo.deleteRecord endpoint
        const response = await fetch(`${BLUESKY_API}/xrpc/com.atproto.repo.deleteRecord`, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${state.session.accessJwt}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                repo: state.session.did,
                collection: "app.bsky.graph.follow",
                rkey: rkey
            })
        });

        if (!response.ok) {
            const error = await response.json();
            console.error(`Failed to unfollow: ${error.message || "Unknown error"}`);
            return false;
        }
        
        return true;
    } catch (error) {
        console.error("Unfollow error:", error);
        return false;
    }
}

async function unfollowSelected(users, selectedIndices, progressCallback, statusCallback) {
    if (selectedIndices.size === 0) {
        return { successful: 0, failed: 0 };
    }

    const indices = Array.from(selectedIndices);
    let successful = 0;
    let failed = 0;
    let minuteCounter = 0;
    let hourCounter = 0;
    const startTime = Date.now();
    
    // Store operation counts for rate limiting
    const opCounts = {
        minute: 0,
        hour: 0,
        day: 0
    };
    
    for (let i = 0; i < indices.length; i++) {
        const index = indices[i];
        const user = users[index];
        if (!user?.did) {
            failed++;
            continue;
        }
        
        // Check if we've hit any rate limits
        const currentMinute = Math.floor((Date.now() - startTime) / 60000);
        const currentHour = Math.floor((Date.now() - startTime) / 3600000);
        
        // Minute threshold check
        if (currentMinute > minuteCounter) {
            minuteCounter = currentMinute;
            opCounts.minute = 0; // Reset minute counter when minute changes
            if (statusCallback) {
                statusCallback(__('minute', {count: minuteCounter + 1}));
            }
        }
        
        // Hour threshold check
        if (currentHour > hourCounter) {
            hourCounter = currentHour;
            opCounts.hour = 0; // Reset hour counter when hour changes
            if (statusCallback) {
                statusCallback(__('hour', {count: hourCounter + 1}));
            }
        }
        
        // Check if we need to pause due to rate limits
        if (opCounts.minute >= RATE_LIMITS.MAX_UNFOLLOWS_PER_MINUTE) {
            const waitTime = 60000 - ((Date.now() - startTime) % 60000);
            if (statusCallback) {
                statusCallback(__('minuteRateLimitReached', {seconds: Math.ceil(waitTime / 1000)}));
            }
            await countdownTimer(Math.ceil(waitTime / 1000), 'minuteRateLimitReached', statusCallback);
            if (statusCallback) {
                statusCallback(__('continuing'));
            }
            minuteCounter++;
            opCounts.minute = 0;
        }
        
        // Check if we've hit hourly limit
        if (opCounts.hour >= RATE_LIMITS.MAX_UNFOLLOWS_PER_HOUR) {
            const waitTime = 3600000 - ((Date.now() - startTime) % 3600000);
            if (statusCallback) {
                statusCallback(__('hourlyRateLimitReached', {minutes: Math.ceil(waitTime / 60000)}));
            }
            await countdownTimerMinutes(Math.ceil(waitTime / 60000), 'hourlyRateLimitReached', statusCallback);
            if (statusCallback) {
                statusCallback(__('continuing'));
            }
            hourCounter++;
            opCounts.hour = 0;
        }
        
        // Check if we've hit daily limit
        if (successful >= RATE_LIMITS.MAX_UNFOLLOWS_PER_DAY) {
            if (statusCallback) {
                statusCallback(__('dailyRateLimitReached'));
            }
            break; // Stop processing if we hit the daily limit
        }

        if (statusCallback) {
            statusCallback(__('unfollowing', {handle: user.handle, current: i + 1, total: indices.length}));
        }
        
        const result = await unfollowUser(user.did, user.followUri);
        
        if (result) {
            successful++;
            // Increment operation counters
            opCounts.minute++;
            opCounts.hour++;
            opCounts.day++;
        } else {
            failed++;
        }
        
        // Report progress
        if (progressCallback) {
            progressCallback(Math.round((i + 1) / indices.length * 100));
        }
        
        // Small delay between requests to be nice to the API
        await new Promise(resolve => setTimeout(resolve, RATE_LIMITS.UNFOLLOW_DELAY_MS));
    }
    
    return { successful, failed };
}

async function createList(name, description) {
    if (!state.session) throw new Error("Not logged in");
    
    try {
        const response = await fetch(`${BLUESKY_API}/xrpc/com.atproto.repo.createRecord`, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${state.session.accessJwt}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                repo: state.session.did,
                collection: "app.bsky.graph.list",
                record: {
                    name,
                    description,
                    purpose: "app.bsky.graph.defs#curatelist",
                    createdAt: new Date().toISOString()
                }
            })
        });

        if (!response.ok) {
            const error = await response.json();
            console.error(`Failed to create list: ${error.message || "Unknown error"}`);
            return null;
        }
        
        const data = await response.json();
        return data.uri;
    } catch (error) {
        console.error("List creation error:", error);
        return null;
    }
}

async function addUserToList(listUri, userDid) {
    if (!state.session) throw new Error("Not logged in");
    
    try {
        const response = await fetch(`${BLUESKY_API}/xrpc/com.atproto.repo.createRecord`, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${state.session.accessJwt}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                repo: state.session.did,
                collection: "app.bsky.graph.listitem",
                record: {
                    subject: userDid,
                    list: listUri,
                    createdAt: new Date().toISOString()
                }
            })
        });

        if (!response.ok) {
            return false;
        }
        
        return true;
    } catch (error) {
        return false;
    }
}

async function createListWithAccounts(users, selectedIndices, progressCallback, statusCallback) {
    if (selectedIndices.size === 0) {
        return null;
    }

    const indices = Array.from(selectedIndices);
    const selectedUsers = indices.map(index => users[index]);

    const date = new Date();
    const dateString = date.toISOString().split('T')[0]; // YYYY-MM-DD
    const listName = `Non-followers ${dateString}`;
    const listDescription = `Accounts that don't follow me back (as of ${dateString})`;

    if (statusCallback) {
        statusCallback(`Creating list "${listName}"...`);
    }
    
    const listUri = await createList(listName, listDescription);
    
    if (!listUri) {
        return null;
    }
    
    if (statusCallback) {
        statusCallback(`List created! Adding ${selectedUsers.length} accounts...`);
    }
    
    let successful = 0;
    let failed = 0;
    
    for (let i = 0; i < selectedUsers.length; i++) {
        const user = selectedUsers[i];
        
        if (!user.did) {
            failed++;
            continue;
        }
        
        const result = await addUserToList(listUri, user.did);
        
        if (result) {
            successful++;
        } else {
            failed++;
        }
        
        // Report progress
        if (progressCallback) {
            progressCallback(Math.round((i + 1) / selectedUsers.length * 100));
        }
        
        // Small delay to avoid rate limits
        await new Promise(resolve => setTimeout(resolve, RATE_LIMITS.PROFILE_INFO_DELAY_MS));
    }
    
    // Extract the handle and rkey from the URI
    // Format is at://did:plc:xyz/app.bsky.graph.list/rkey
    const parts = listUri.split('/');
    const handle = state.session.handle;
    const rkey = parts[parts.length - 1];
    const listUrl = `https://bsky.app/profile/${handle}/lists/${rkey}`;
    
    return { successful, failed, listUri, listUrl };
}

// UI update functions
function updateUserInfo() {
    if (!state.session) return;
    
    elements.userInfo.innerHTML = `
        <h3>${__('loggedInAs', {handle: state.session.handle})}</h3>
        <div id="stats">
            <p>${__('followStats', {follows: state.follows.length, followers: state.followers.length})}</p>
        </div>
    `;
}

function updateStats() {
    const nonFollowBackCount = state.nonFollowBacks.length;
    const whitelistedCount = state.whitelist.size;
    
    elements.statsContainer.innerHTML = `
        <div class="info-box">
            <h4>${__('nonFollowersCount', {count: nonFollowBackCount})} <span class="badge">${nonFollowBackCount}</span></h4>
            ${whitelistedCount > 0 ? 
                `<p><small>${__('whitelistedCount', {count: whitelistedCount})}</small></p>` : ''}
            <p><button id="loadFollowCountsBtn">${__('loadFollowCounts')}</button></p>
        </div>
    `;
    
    // Add event listener to the load following counts button
    document.getElementById('loadFollowCountsBtn').addEventListener('click', handleLoadFollowCounts);
}

function populateNonFollowersTable() {
    elements.nonFollowersTable.innerHTML = '';
    
    state.nonFollowBacks.forEach((user, index) => {
        const row = document.createElement('tr');
        
        // Check if user is whitelisted
        const isWhitelisted = state.whitelist.has(user.handle.toLowerCase());
        
        // Create profile URL
        const profileUrl = `https://bsky.app/profile/${user.handle}`;
        
        row.innerHTML = `
            <td>
                <input type="checkbox" id="checkbox-${index}" data-index="${index}" class="account-checkbox" ${isWhitelisted ? '' : 'checked'}>
            </td>
            <td>
                <span class="mobile-label">${__('account')}:</span>
                <div>
                    <strong>${user.displayName || user.handle}</strong>
                    <small>@${user.handle}</small>
                    <a href="${profileUrl}" target="_blank" class="profile-button" aria-label="${__('visitProfile')}">
                        <span class="external-link-icon">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                                <polyline points="15 3 21 3 21 9"></polyline>
                                <line x1="10" y1="14" x2="21" y2="3"></line>
                            </svg>
                        </span>
                    </a>
                </div>
            </td>
            <td class="follows-count">
                <span class="mobile-label">${__('follows')}:</span>
                ${user.followsCount !== undefined ? 
                    __('followsCount', {count: user.followsCount}) : 
                    '–'}
            </td>
        `;
        
        // Make the entire row clickable (except for the checkbox or profile button)
        row.style.cursor = 'pointer';
        row.addEventListener('click', function(event) {
            // Don't toggle if clicking directly on the checkbox or profile button
            if (event.target.type !== 'checkbox' && 
                !event.target.classList.contains('profile-button') &&
                event.target.tagName !== 'A') {
                const checkbox = this.querySelector('.account-checkbox');
                checkbox.checked = !checkbox.checked;
                
                // Trigger the change event manually
                const changeEvent = new Event('change', { bubbles: true });
                checkbox.dispatchEvent(changeEvent);
            }
        });
        
        elements.nonFollowersTable.appendChild(row);
    });
    
    // Add event listeners to the checkboxes
    document.querySelectorAll('.account-checkbox').forEach(checkbox => {
        checkbox.addEventListener('change', function() {
            const index = parseInt(this.getAttribute('data-index'));
            const user = state.nonFollowBacks[index];
            
            if (!this.checked) {
                // Add to whitelist when unchecked
                state.whitelist.add(user.handle.toLowerCase());
                state.selectedIndices.delete(index);
            } else {
                // Remove from whitelist when checked
                state.whitelist.delete(user.handle.toLowerCase());
                state.selectedIndices.add(index);
            }
            
            // Save whitelist to localStorage
            saveWhitelist(state.whitelist);
            
            updateActionButtons();
        });
        
        // Add checked accounts to selectedIndices
        const index = parseInt(checkbox.getAttribute('data-index'));
        if (checkbox.checked) {
            state.selectedIndices.add(index);
        }
    });
    
    // Set up the select all checkbox
    elements.selectAllCheckbox.addEventListener('change', function() {
        document.querySelectorAll('.account-checkbox').forEach(checkbox => {
            checkbox.checked = this.checked;
            const index = parseInt(checkbox.getAttribute('data-index'));
            const user = state.nonFollowBacks[index];
            
            if (!this.checked) {
                // Add to whitelist when unchecked
                state.whitelist.add(user.handle.toLowerCase());
                state.selectedIndices.delete(index);
            } else {
                // Remove from whitelist when checked
                state.whitelist.delete(user.handle.toLowerCase());
                state.selectedIndices.add(index);
            }
        });
        
        // Save whitelist to localStorage
        saveWhitelist(state.whitelist);
        
        updateActionButtons();
    });
    
    updateActionButtons();
}

function updateActionButtons() {
    const selectedCount = state.selectedIndices.size;
    elements.unfollowButton.textContent = __('unfollowButton', {count: selectedCount});
    elements.createListButton.textContent = __('createListButton', {count: selectedCount});
    elements.bothButton.textContent = __('bothButton', {count: selectedCount});
    
    const buttonsDisabled = selectedCount === 0;
    elements.unfollowButton.disabled = buttonsDisabled;
    elements.createListButton.disabled = buttonsDisabled;
    elements.bothButton.disabled = buttonsDisabled;
}

// Event handlers
async function handleLogin() {
    const identifier = elements.identifier.value.trim();
    const password = elements.password.value;
    
    if (!identifier || !password) {
        showError(__('enterCredentials'));
        return;
    }
    
    try {
        elements.loginButton.disabled = true;
        elements.loginButton.innerHTML = '<span class="spinner"></span> ' + __('login') + '...';
        
        // Load whitelist from localStorage
        state.whitelist = loadWhitelist();
        
        // Login to Bluesky
        state.session = await loginToBluesky(identifier, password);
        
        // Fetch follows and followers
        elements.loginButton.innerHTML = '<span class="spinner"></span> ' + __('login') + '...';
        state.follows = await getFollows();
        
        elements.loginButton.innerHTML = '<span class="spinner"></span> ' + __('login') + '...';
        state.followers = await getFollowers();
        
        // Compute non-follow-backs
        state.nonFollowBacks = findNonFollowBacks(state.follows, state.followers);
        
        // Update UI
        updateUserInfo();
        updateStats();
        populateNonFollowersTable();
        
        // Show results section
        hideElement(elements.loginSection);
        showElement(elements.resultsSection);
        showElement(elements.logoutContainer);
        
    } catch (error) {
        showError(__('loginFailed'));
    } finally {
        elements.loginButton.disabled = false;
        elements.loginButton.textContent = __('loginButton');
    }
}

async function handleLoadFollowCounts() {
    try {
        // Show loading UI
        showElement(elements.loadingFollowCounts);
        document.getElementById('loadFollowCountsBtn').disabled = true;
        
        // Update following counts with progress updates
        await enrichWithProfileData(state.nonFollowBacks, (progress) => {
            elements.followCountsProgress.textContent = `${progress}`;
            setProgressBar(elements.followCountsProgressBar, progress);
        });
        
        // Update the table with following counts
        document.querySelectorAll('.follows-count').forEach((cell, index) => {
            const user = state.nonFollowBacks[index];
            cell.textContent = __('followsCount', {count: user.followsCount || 0});
        });
        
        // Hide loading UI
        hideElement(elements.loadingFollowCounts);
        document.getElementById('loadFollowCountsBtn').textContent = __('refreshFollowCounts');
        document.getElementById('loadFollowCountsBtn').disabled = false;
        
    } catch (error) {
        showError(__('errorLoadingCounts', {message: error.message}));
        hideElement(elements.loadingFollowCounts);
        document.getElementById('loadFollowCountsBtn').disabled = false;
    }
}

async function handleUnfollow() {
    if (state.selectedIndices.size === 0) return;
    
    if (!confirm(__('confirmUnfollow', {count: state.selectedIndices.size}))) {
        return;
    }
    
    try {
        // Show progress UI
        elements.actionTitle.textContent = __('unfollowButton', {count: state.selectedIndices.size});
        showElement(elements.actionProgress);
        hideElement(elements.actionResults);
        
        elements.unfollowButton.disabled = true;
        elements.createListButton.disabled = true;
        elements.bothButton.disabled = true;
        
        // Execute unfollow operation
        const result = await unfollowSelected(
            state.nonFollowBacks,
            state.selectedIndices,
            (progress) => {
                setProgressBar(elements.actionProgressBar, progress);
            },
            (status) => {
                elements.actionStatus.textContent = status;
            }
        );
        
        // Show results
        showElement(elements.actionResults);
        elements.actionResultsContent.innerHTML = `
            <p>${__('successfullyUnfollowed', {count: result.successful})}</p>
            ${result.failed > 0 ? `<p>${__('failedToUnfollow', {count: result.failed})}</p>` : ''}
        `;
        
        // Re-enable buttons
        elements.unfollowButton.disabled = false;
        elements.createListButton.disabled = false;
        elements.bothButton.disabled = false;
        
        // Remove unfollowed accounts from the list if successful
        if (result.successful > 0) {
            await reloadData();
        }
        
    } catch (error) {
        showError(__('errorUnfollowing', {message: error.message}));
        elements.unfollowButton.disabled = false;
        elements.createListButton.disabled = false;
        elements.bothButton.disabled = false;
    }
}

async function handleCreateList() {
    if (state.selectedIndices.size === 0) return;
    
    try {
        // Show progress UI
        elements.actionTitle.textContent = __('createListButton', {count: state.selectedIndices.size});
        showElement(elements.actionProgress);
        hideElement(elements.actionResults);
        
        elements.unfollowButton.disabled = true;
        elements.createListButton.disabled = true;
        elements.bothButton.disabled = true;
        
        // Execute list creation
        const result = await createListWithAccounts(
            state.nonFollowBacks,
            state.selectedIndices,
            (progress) => {
                setProgressBar(elements.actionProgressBar, progress);
            },
            (status) => {
                elements.actionStatus.textContent = status;
            }
        );
        
        // Show results
        showElement(elements.actionResults);
        if (result) {
            elements.actionResultsContent.innerHTML = `
                <p>${__('listCreatedSuccess')}</p>
                <p>${__('accountsAdded', {count: result.successful})}</p>
                ${result.failed > 0 ? `<p>${__('failedToAdd', {count: result.failed})}</p>` : ''}
                <p><a href="${result.listUrl}" target="_blank">${__('viewList')}</a></p>
            `;
        } else {
            elements.actionResultsContent.innerHTML = `
                <p>${__('failedToCreateList')}</p>
            `;
        }
        
        // Re-enable buttons
        elements.unfollowButton.disabled = false;
        elements.createListButton.disabled = false;
        elements.bothButton.disabled = false;
        
    } catch (error) {
        showError(__('errorCreatingList', {message: error.message}));
        elements.unfollowButton.disabled = false;
        elements.createListButton.disabled = false;
        elements.bothButton.disabled = false;
    }
}

async function handleBoth() {
    if (state.selectedIndices.size === 0) return;
    
    if (!confirm(__('confirmBoth', {count: state.selectedIndices.size}))) {
        return;
    }
    
    try {
        // First create the list
        elements.actionTitle.textContent = __('createListButton', {count: state.selectedIndices.size});
        showElement(elements.actionProgress);
        hideElement(elements.actionResults);
        
        elements.unfollowButton.disabled = true;
        elements.createListButton.disabled = true;
        elements.bothButton.disabled = true;
        
        // Step 1: Create list
        const listResult = await createListWithAccounts(
            state.nonFollowBacks,
            state.selectedIndices,
            (progress) => {
                setProgressBar(elements.actionProgressBar, progress);
            },
            (status) => {
                elements.actionStatus.textContent = status;
            }
        );
        
        // Step 2: Unfollow accounts
        elements.actionTitle.textContent = 'Unfollowing Accounts';
        elements.actionStatus.textContent = 'Preparing to unfollow...';
        setProgressBar(elements.actionProgressBar, 0);
        
        const unfollowResult = await unfollowSelected(
            state.nonFollowBacks,
            state.selectedIndices,
            (progress) => {
                setProgressBar(elements.actionProgressBar, progress);
            },
            (status) => {
                elements.actionStatus.textContent = status;
            }
        );
        
        // Show combined results
        showElement(elements.actionResults);
        elements.actionResultsContent.innerHTML = `
            <h4>List Creation:</h4>
            ${listResult ? `
                <p>✅ List created successfully!</p>
                <p>✅ Added ${listResult.successful} accounts to the list</p>
                ${listResult.failed > 0 ? `<p>❌ Failed to add ${listResult.failed} accounts</p>` : ''}
                <p><a href="${listResult.listUrl}" target="_blank">View List on Bluesky</a></p>
            ` : `
                <p>❌ Failed to create list</p>
            `}
            
            <h4>Unfollow Results:</h4>
            <p>✅ Successfully unfollowed: ${unfollowResult.successful}</p>
            ${unfollowResult.failed > 0 ? `<p>❌ Failed to unfollow: ${unfollowResult.failed}</p>` : ''}
        `;
        
        // Re-enable buttons
        elements.unfollowButton.disabled = false;
        elements.createListButton.disabled = false;
        elements.bothButton.disabled = false;
        
        // Remove unfollowed accounts from the list if successful
        if (unfollowResult.successful > 0) {
            await reloadData();
        }
        
    } catch (error) {
        showError(__('errorGeneric', {message: error.message}));
        elements.unfollowButton.disabled = false;
        elements.createListButton.disabled = false;
        elements.bothButton.disabled = false;
    }
}

function handleLogout() {
    if (confirm(__('confirmLogout'))) {
        // Clear state
        state.session = null;
        state.follows = [];
        state.followers = [];
        state.nonFollowBacks = [];
        state.selectedIndices = new Set();
        
        // Reset UI
        elements.identifier.value = '';
        elements.password.value = '';
        hideElement(elements.resultsSection);
        hideElement(elements.logoutContainer);
        showElement(elements.loginSection);
        
        // Reset progress elements
        hideElement(elements.loadingFollowCounts);
        hideElement(elements.actionProgress);
        hideElement(elements.actionResults);
    }
}

async function reloadData() {
    try {
        // Reset selected indices
        state.selectedIndices = new Set();
        
        // Fetch follows and followers again
        state.follows = await getFollows();
        state.followers = await getFollowers();
        
        // Compute non-follow-backs
        state.nonFollowBacks = findNonFollowBacks(state.follows, state.followers);
        
        // Update UI
        updateUserInfo();
        updateStats();
        populateNonFollowersTable();
        
    } catch (error) {
        showError(__('errorReloading', {message: error.message}));
    }
}

// Handle language change
function handleLanguageChange(event) {
    currentLanguage = event.target.value;
    
    // Save preference in localStorage
    localStorage.setItem('blueskyFollowerCheckerLang', currentLanguage);
    
    // Update UI with new language
    updateUILanguage();
}

// Set up event listeners
elements.loginButton.addEventListener('click', handleLogin);
elements.unfollowButton.addEventListener('click', handleUnfollow);
elements.createListButton.addEventListener('click', handleCreateList);
elements.bothButton.addEventListener('click', handleBoth);
elements.logoutButton.addEventListener('click', handleLogout);

// Support for Enter key in login form
elements.identifier.addEventListener('keyup', function(event) {
    if (event.key === 'Enter') {
        elements.password.focus();
    }
});

elements.password.addEventListener('keyup', function(event) {
    if (event.key === 'Enter') {
        handleLogin();
    }
});

// Initialize language
function initializeLanguage() {
    // Check if there's a saved preference
    const savedLang = localStorage.getItem('blueskyFollowerCheckerLang');
    if (savedLang && (savedLang === 'en' || savedLang === 'tr')) {
        currentLanguage = savedLang;
    }
    
    // Update UI with the selected language
    updateUILanguage();
}

// Call after DOM is loaded
document.addEventListener('DOMContentLoaded', initializeLanguage);