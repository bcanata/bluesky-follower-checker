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
    FOLLOW_DELAY_MS: 1000, // 1 second between follows
    PROFILE_INFO_DELAY_MS: 25, // 25ms between profile info requests (less conservative)
    
    // Bluesky's documented rate limits (as of April 2025)
    MAX_UNFOLLOWS_PER_MINUTE: 60, // Can be higher based on 5,000 points/hour limit for DELETE ops (1 point each)
    MAX_FOLLOWS_PER_MINUTE: 60, // Similar limit for follows (CREATE operations = 3 points)
    MAX_UNFOLLOWS_PER_HOUR: 3000, // Value lower than the 5,000 points/hour to be safe
    MAX_FOLLOWS_PER_HOUR: 1600, // Lower since CREATE operations cost 3 points (5000/3 ≈ 1666)
    MAX_UNFOLLOWS_PER_DAY: 30000, // Value lower than the 35,000 points/day to be safe
    MAX_FOLLOWS_PER_DAY: 10000, // Lower since CREATE operations cost 3 points (35000/3 ≈ 11666)
    MAX_API_REQUESTS: 2500 // 3000 per 5 minutes, using 2500 to be conservative
};

// LocalStorage keys
const STORAGE_KEYS = {
    WHITELIST: 'blueskyFollowerCheckerWhitelist',
    FOLLOW_WHITELIST: 'blueskyFollowerCheckerFollowWhitelist'
};

// State management
const state = {
    session: null,
    follows: [],
    followers: [],
    nonFollowBacks: [],
    followersYouDontFollow: [], // New: followers that you don't follow back
    whitelist: new Set(), // Whitelist of handles (for non-followers)
    followWhitelist: new Set(), // Whitelist of handles (for followers you don't follow)
    selectedIndices: new Set(),
    selectedFollowerIndices: new Set() // Selected indices for the follow tab
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
    
    // New: Followers you don't follow tab elements
    followersYouDontFollowTab: document.getElementById('followersYouDontFollowTab'),
    followersYouDontFollowTable: document.getElementById('followersYouDontFollowTable'),
    followersYouDontFollowStatsContainer: document.getElementById('followersYouDontFollowStatsContainer'),
    selectAllFollowersCheckbox: document.getElementById('selectAllFollowersCheckbox'),
    
    // Post counts loading
    loadingPostCounts: document.getElementById('loadingPostCounts'),
    postCountsProgress: document.getElementById('postCountsProgress'),
    postCountsProgressBar: document.getElementById('postCountsProgressBar'),
    
    // Follow action elements
    followButton: document.getElementById('followButton'),
    createFollowListButton: document.getElementById('createFollowListButton'),
    bothFollowButton: document.getElementById('bothFollowButton'),
    followActionProgress: document.getElementById('followActionProgress'),
    followActionTitle: document.getElementById('followActionTitle'),
    followActionStatus: document.getElementById('followActionStatus'),
    followActionProgressBar: document.getElementById('followActionProgressBar'),
    followActionResults: document.getElementById('followActionResults'),
    followActionResultsContent: document.getElementById('followActionResultsContent'),
    
    // Logout
    logoutContainer: document.getElementById('logoutContainer'),
    logoutButton: document.getElementById('logoutButton')
};

// Helper functions
function showElement(element) {
    if (element) {
        element.classList.remove('hidden');
    } else {
        console.warn("Attempted to show a null element");
    }
}

function hideElement(element) {
    if (element) {
        element.classList.add('hidden');
    } else {
        console.warn("Attempted to hide a null element");
    }
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

// Function to find followers you don't follow back
function findFollowersYouDontFollow(follows, followers) {
    const followHandles = new Set(follows.map(f => f.handle.toLowerCase()));
    return followers.filter(follower => !followHandles.has(follower.handle.toLowerCase()));
}

// Load whitelist for followers you don't follow
function loadFollowWhitelist() {
    try {
        const whitelistStr = localStorage.getItem(STORAGE_KEYS.FOLLOW_WHITELIST);
        if (!whitelistStr) return new Set();
        
        return new Set(JSON.parse(whitelistStr));
    } catch (e) {
        console.error('Failed to load follow whitelist', e);
        return new Set();
    }
}

// Save whitelist for followers you don't follow
function saveFollowWhitelist(whitelist) {
    try {
        localStorage.setItem(STORAGE_KEYS.FOLLOW_WHITELIST, JSON.stringify(Array.from(whitelist)));
    } catch (e) {
        console.error('Failed to save follow whitelist', e);
    }
}

// Fetch post counts for users
async function getPostInfo(did) {
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
            return { postsCount: 0 };
        }

        const data = await response.json();
        return { 
            postsCount: data.postsCount || 0
        };
    } catch (error) {
        console.error(`Error fetching profile for ${did}:`, error);
        return { postsCount: 0 };
    }
}

// Enrich users with post count data
async function enrichWithPostData(users, progressCallback) {
    for (let i = 0; i < users.length; i++) {
        const user = users[i];
        if (user.did) {
            try {
                const profile = await getPostInfo(user.did);
                user.postsCount = profile.postsCount;
                
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

// Follow a user
async function followUser(did) {
    if (!state.session) throw new Error("Not logged in");
    if (!did) throw new Error("Invalid DID provided");
    
    try {
        const response = await fetch(`${BLUESKY_API}/xrpc/com.atproto.repo.createRecord`, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${state.session.accessJwt}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                repo: state.session.did,
                collection: "app.bsky.graph.follow",
                record: {
                    subject: did,
                    createdAt: new Date().toISOString()
                }
            })
        });

        if (!response.ok) {
            const error = await response.json();
            console.error(`Failed to follow: ${error.message || "Unknown error"}`);
            return false;
        }
        
        return true;
    } catch (error) {
        console.error("Follow error:", error);
        return false;
    }
}

// Follow selected users
async function followSelected(users, selectedIndices, progressCallback, statusCallback) {
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
                statusCallback(__(__('minute', {count: minuteCounter + 1})));
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
        if (opCounts.minute >= RATE_LIMITS.MAX_FOLLOWS_PER_MINUTE) {
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
        if (opCounts.hour >= RATE_LIMITS.MAX_FOLLOWS_PER_HOUR) {
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
        if (successful >= RATE_LIMITS.MAX_FOLLOWS_PER_DAY) {
            if (statusCallback) {
                statusCallback(__('dailyRateLimitReached'));
            }
            break; // Stop processing if we hit the daily limit
        }

        if (statusCallback) {
            statusCallback(__('following', {handle: user.handle, current: i + 1, total: indices.length}));
        }
        
        const result = await followUser(user.did);
        
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
        await new Promise(resolve => setTimeout(resolve, RATE_LIMITS.FOLLOW_DELAY_MS));
    }
    
    return { successful, failed };
}

// Create a list of followers you don't follow
async function createFollowListWithAccounts(users, selectedIndices, progressCallback, statusCallback) {
    if (selectedIndices.size === 0) {
        return null;
    }

    const indices = Array.from(selectedIndices);
    const selectedUsers = indices.map(index => users[index]);

    const date = new Date();
    const dateString = date.toISOString().split('T')[0]; // YYYY-MM-DD
    const listName = `Followers I Don't Follow ${dateString}`;
    const listDescription = `Accounts that follow me but I don't follow back (as of ${dateString})`;

    if (statusCallback) {
        statusCallback(__('creatingList', {name: listName}));
    }
    
    const listUri = await createList(listName, listDescription);
    
    if (!listUri) {
        return null;
    }
    
    if (statusCallback) {
        statusCallback(__('listCreated', {count: selectedUsers.length}));
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

// Tab functionality
if (elements.tabButtons && elements.tabButtons.length > 0) {
    elements.tabButtons.forEach(button => {
        if (button) {
            button.addEventListener('click', () => {
                const tab = button.getAttribute('data-tab');
                
                // Update active tab button
                elements.tabButtons.forEach(btn => {
                    if (btn) {
                        btn.classList.remove('active');
                    }
                });
                button.classList.add('active');
                
                // Update active tab content
                if (elements.tabContents && elements.tabContents.length > 0) {
                    elements.tabContents.forEach(content => {
                        if (content) {
                            content.classList.remove('active');
                        }
                    });
                }
                
                // Activate the correct tab content
                let activeContent;
                if (tab === 'nonFollowers') {
                    activeContent = document.getElementById('nonFollowersTab');
                } else if (tab === 'followersYouDontFollow') {
                    activeContent = document.getElementById('followersYouDontFollowTab');
                    // If this tab is being activated and we haven't loaded the data yet, do it now
                    if (activeContent && state.followersYouDontFollow.length === 0 && state.followers.length > 0 && state.follows.length > 0) {
                        loadFollowersYouDontFollow();
                    }
                }
                
                if (activeContent) {
                    activeContent.classList.add('active');
                }
            });
        }
    });
}

// API interaction functions
async function loginToBluesky(identifier, password) {
    try {
        console.log("Attempting to create session with Bluesky API");
        const response = await fetch(`${BLUESKY_API}/xrpc/com.atproto.server.createSession`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ identifier, password }),
        });

        // Log the status of the response for debugging
        console.log(`Bluesky API response status: ${response.status} (${response.ok ? 'OK' : 'Error'})`);

        if (!response.ok) {
            const error = await response.json();
            console.error("Login API error response:", error);
            throw new Error(`Login failed: ${error.message || "Unknown error"}`);
        }

        // Parse the response body
        const data = await response.json();
        console.log("Login successful, received session data");
        return data;
    } catch (error) {
        // More detailed error logging
        if (error.name === "SyntaxError") {
            console.error("Failed to parse response as JSON. Possible network or API issue.");
        } else {
            console.error("Login error:", error.message || error);
        }
        // Instead of rethrowing with a generic message, pass through the original error
        // This will help us identify what's actually happening
        throw error;
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
                <input type="checkbox" id="checkbox-${index}" data-index="${index}" class="account-checkbox custom-checkbox" ${isWhitelisted ? '' : 'checked'}>
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
    elements.selectAllCheckbox.classList.add('custom-checkbox');
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
    
    elements.loginButton.disabled = true;
    elements.loginButton.innerHTML = '<span class="spinner"></span> ' + __('login') + '...';
    
    try {
        console.log("Starting login process");
        // Load whitelist from localStorage
        state.whitelist = loadWhitelist();
        
        try {
            // Login to Bluesky
            console.log("Attempting login with Bluesky API");
            state.session = await loginToBluesky(identifier, password);
            console.log("Login successful, session established");

            try {
                // Fetch follows and followers
                console.log("Starting data fetch");
                elements.loginButton.innerHTML = '<span class="spinner"></span> ' + __('fetchingFollows') + '...';
                state.follows = await getFollows();
                console.log(`Successfully fetched ${state.follows.length} follows`);
                
                elements.loginButton.innerHTML = '<span class="spinner"></span> ' + __('fetchingFollowers') + '...';
                state.followers = await getFollowers();
                console.log(`Successfully fetched ${state.followers.length} followers`);
                
                // Process the data and update UI
                console.log("Processing follower/following data");
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
                
                console.log("Login and data fetch process completed successfully");
                return;
                
            } catch (dataError) {
                // Error during data fetching
                console.error("Error during data fetching:", dataError);
                
                // Only show error message if we actually have no data
                if (state.followers.length === 0 && state.follows.length === 0) {
                    console.log("No follower or following data could be retrieved");
                    showError(__('errorFetchingData'));
                } else {
                    // We have at least some data, so proceed
                    console.log("Partial data retrieved, continuing with available data");
                    state.nonFollowBacks = findNonFollowBacks(state.follows, state.followers);
                    
                    // Update UI with what we have
                    updateUserInfo();
                    updateStats();
                    populateNonFollowersTable();
                    
                    // Show results section
                    hideElement(elements.loginSection);
                    showElement(elements.resultsSection);
                    showElement(elements.logoutContainer);
                }
            }
        } catch (error) {
            // This is specifically a login error
            console.error("Authentication failed:", error);
            
            // Check for network errors which might be mistakenly reported as login failures
            if (error.name === "TypeError" && error.message.includes("Failed to fetch")) {
                showError("Network error: Check your internet connection and try again.");
            } else {
                showError(__('loginFailed'));
            }
        }
    } catch (e) {
        // Unexpected top-level error
        console.error("Unexpected error in login process:", e);
        showError(__('errorGeneric', {message: e.message || "Unknown error"}));
    } finally {
        // Always reset the button
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
if (elements.loginButton) {
    elements.loginButton.addEventListener('click', handleLogin);
}
if (elements.unfollowButton) {
    elements.unfollowButton.addEventListener('click', handleUnfollow);
}
if (elements.createListButton) {
    elements.createListButton.addEventListener('click', handleCreateList);
}
if (elements.bothButton) {
    elements.bothButton.addEventListener('click', handleBoth);
}
if (elements.logoutButton) {
    elements.logoutButton.addEventListener('click', handleLogout);
}

// Event listeners for followers you don't follow tab
if (elements.followButton) {
    elements.followButton.addEventListener('click', handleFollow);
}
if (elements.createFollowListButton) {
    elements.createFollowListButton.addEventListener('click', handleCreateFollowList);
}
if (elements.bothFollowButton) {
    elements.bothFollowButton.addEventListener('click', handleBothFollow);
}

// Support for Enter key in login form
if (elements.identifier) {
    elements.identifier.addEventListener('keyup', function(event) {
        if (event.key === 'Enter') {
            elements.password.focus();
        }
    });
}

if (elements.password) {
    elements.password.addEventListener('keyup', function(event) {
        if (event.key === 'Enter') {
            handleLogin();
        }
    });
}

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

// Load followers you don't follow data
async function loadFollowersYouDontFollow() {
    if (!state.session) return;
    if (state.followers.length === 0 || state.follows.length === 0) return;
    
    // Find followers that you don't follow back
    state.followersYouDontFollow = findFollowersYouDontFollow(state.follows, state.followers);
    
    // Load the follow whitelist
    state.followWhitelist = loadFollowWhitelist();
    
    // Update UI
    updateFollowersYouDontFollowStats();
    populateFollowersYouDontFollowTable();
}

// Update stats for followers you don't follow
function updateFollowersYouDontFollowStats() {
    const followersYouDontFollowCount = state.followersYouDontFollow.length;
    const followWhitelistedCount = state.followWhitelist.size;
    
    elements.followersYouDontFollowStatsContainer.innerHTML = `
        <div class="info-box">
            <h4>${__('followersYouDontFollowCount', {count: followersYouDontFollowCount})} <span class="badge">${followersYouDontFollowCount}</span></h4>
            ${followWhitelistedCount > 0 ? 
                `<p><small>${__('followWhitelistedCount', {count: followWhitelistedCount})}</small></p>` : ''}
            <p><button id="loadPostCountsBtn">${__('loadPostCounts')}</button></p>
        </div>
    `;
    
    // Add event listener to the load post counts button
    document.getElementById('loadPostCountsBtn').addEventListener('click', handleLoadPostCounts);
}

// Populate the table with followers you don't follow
function populateFollowersYouDontFollowTable() {
    elements.followersYouDontFollowTable.innerHTML = '';
    
    state.followersYouDontFollow.forEach((user, index) => {
        const row = document.createElement('tr');
        
        // Check if user is whitelisted
        const isWhitelisted = state.followWhitelist.has(user.handle.toLowerCase());
        
        // Create profile URL
        const profileUrl = `https://bsky.app/profile/${user.handle}`;
        
        row.innerHTML = `
            <td>
                <input type="checkbox" id="follower-checkbox-${index}" data-index="${index}" class="follower-checkbox custom-checkbox" ${isWhitelisted ? '' : 'checked'}>
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
            <td class="posts-count">
                <span class="mobile-label">Posts:</span>
                ${user.postsCount !== undefined ? 
                    __('postCount', {count: user.postsCount}) : 
                    '–'}
            </td>
        `;
        
        elements.followersYouDontFollowTable.appendChild(row);
    });
    
    // Add event listeners to the checkboxes
    document.querySelectorAll('.follower-checkbox').forEach(checkbox => {
        checkbox.addEventListener('change', function() {
            const index = parseInt(this.getAttribute('data-index'));
            const user = state.followersYouDontFollow[index];
            
            if (!this.checked) {
                // Add to whitelist when unchecked
                state.followWhitelist.add(user.handle.toLowerCase());
                state.selectedFollowerIndices.delete(index);
            } else {
                // Remove from whitelist when checked
                state.followWhitelist.delete(user.handle.toLowerCase());
                state.selectedFollowerIndices.add(index);
            }
            
            // Save whitelist to localStorage
            saveFollowWhitelist(state.followWhitelist);
            
            updateFollowActionButtons();
        });
        
        // Add checked accounts to selectedFollowerIndices
        const index = parseInt(checkbox.getAttribute('data-index'));
        if (checkbox.checked) {
            state.selectedFollowerIndices.add(index);
        }
    });
    
    // Set up the select all checkbox
    elements.selectAllFollowersCheckbox.classList.add('custom-checkbox');
    elements.selectAllFollowersCheckbox.addEventListener('change', function() {
        document.querySelectorAll('.follower-checkbox').forEach(checkbox => {
            checkbox.checked = this.checked;
            const index = parseInt(checkbox.getAttribute('data-index'));
            const user = state.followersYouDontFollow[index];
            
            if (!this.checked) {
                // Add to whitelist when unchecked
                state.followWhitelist.add(user.handle.toLowerCase());
                state.selectedFollowerIndices.delete(index);
            } else {
                // Remove from whitelist when checked
                state.followWhitelist.delete(user.handle.toLowerCase());
                state.selectedFollowerIndices.add(index);
            }
        });
        
        // Save whitelist to localStorage
        saveFollowWhitelist(state.followWhitelist);
        
        updateFollowActionButtons();
    });
    
    updateFollowActionButtons();
}

// Update follow action buttons
function updateFollowActionButtons() {
    const selectedCount = state.selectedFollowerIndices.size;
    elements.followButton.textContent = __('followButton', {count: selectedCount});
    elements.createFollowListButton.textContent = __('createFollowListButton', {count: selectedCount});
    elements.bothFollowButton.textContent = __('bothFollowButton', {count: selectedCount});
    
    const buttonsDisabled = selectedCount === 0;
    elements.followButton.disabled = buttonsDisabled;
    elements.createFollowListButton.disabled = buttonsDisabled;
    elements.bothFollowButton.disabled = buttonsDisabled;
}

// Load post counts for followers you don't follow
async function handleLoadPostCounts() {
    try {
        // Show loading UI
        showElement(elements.loadingPostCounts);
        document.getElementById('loadPostCountsBtn').disabled = true;
        
        // Update post counts with progress updates
        await enrichWithPostData(state.followersYouDontFollow, (progress) => {
            elements.postCountsProgress.textContent = `${progress}`;
            setProgressBar(elements.postCountsProgressBar, progress);
        });
        
        // Update the table with post counts
        document.querySelectorAll('.posts-count').forEach((cell, index) => {
            const user = state.followersYouDontFollow[index];
            cell.textContent = __('postCount', {count: user.postsCount || 0});
        });
        
        // Hide loading UI
        hideElement(elements.loadingPostCounts);
        document.getElementById('loadPostCountsBtn').textContent = __('refreshPostCounts');
        document.getElementById('loadPostCountsBtn').disabled = false;
        
    } catch (error) {
        showError(__('errorLoadingCounts', {message: error.message}));
        hideElement(elements.loadingPostCounts);
        document.getElementById('loadPostCountsBtn').disabled = false;
    }
}

// Handle follow action
async function handleFollow() {
    // Check if data is loaded, and load it if needed
    if (state.followersYouDontFollow.length === 0 && state.followers.length > 0 && state.follows.length > 0) {
        await loadFollowersYouDontFollow();
    }

    if (state.selectedFollowerIndices.size === 0) return;
    
    if (!confirm(__('confirmFollow', {count: state.selectedFollowerIndices.size}))) {
        return;
    }
    
    try {
        // Show progress UI
        elements.followActionTitle.textContent = __('followButton', {count: state.selectedFollowerIndices.size});
        showElement(elements.followActionProgress);
        hideElement(elements.followActionResults);
        
        elements.followButton.disabled = true;
        elements.createFollowListButton.disabled = true;
        elements.bothFollowButton.disabled = true;
        
        // Execute follow operation
        const result = await followSelected(
            state.followersYouDontFollow,
            state.selectedFollowerIndices,
            (progress) => {
                setProgressBar(elements.followActionProgressBar, progress);
            },
            (status) => {
                elements.followActionStatus.textContent = status;
            }
        );
        
        // Show results
        showElement(elements.followActionResults);
        elements.followActionResultsContent.innerHTML = `
            <p>${__('successfullyFollowed', {count: result.successful})}</p>
            ${result.failed > 0 ? `<p>${__('failedToFollow', {count: result.failed})}</p>` : ''}
        `;
        
        // Re-enable buttons
        elements.followButton.disabled = false;
        elements.createFollowListButton.disabled = false;
        elements.bothFollowButton.disabled = false;
        
        // Reload data if any follows were successful
        if (result.successful > 0) {
            await reloadData();
            // Reload the followers you don't follow tab since it's changed
            loadFollowersYouDontFollow();
        }
        
    } catch (error) {
        showError(__('errorFollowing', {message: error.message}));
        elements.followButton.disabled = false;
        elements.createFollowListButton.disabled = false;
        elements.bothFollowButton.disabled = false;
    }
}

// Handle create list for followers you don't follow
async function handleCreateFollowList() {
    // Check if data is loaded, and load it if needed
    if (state.followersYouDontFollow.length === 0 && state.followers.length > 0 && state.follows.length > 0) {
        await loadFollowersYouDontFollow();
    }
    
    if (state.selectedFollowerIndices.size === 0) return;
    
    try {
        // Show progress UI
        elements.followActionTitle.textContent = __('createFollowListButton', {count: state.selectedFollowerIndices.size});
        showElement(elements.followActionProgress);
        hideElement(elements.followActionResults);
        
        elements.followButton.disabled = true;
        elements.createFollowListButton.disabled = true;
        elements.bothFollowButton.disabled = true;
        
        // Execute list creation
        const result = await createFollowListWithAccounts(
            state.followersYouDontFollow,
            state.selectedFollowerIndices,
            (progress) => {
                setProgressBar(elements.followActionProgressBar, progress);
            },
            (status) => {
                elements.followActionStatus.textContent = status;
            }
        );
        
        // Show results
        showElement(elements.followActionResults);
        if (result) {
            elements.followActionResultsContent.innerHTML = `
                <p>${__('listCreatedSuccess')}</p>
                <p>${__('accountsAdded', {count: result.successful})}</p>
                ${result.failed > 0 ? `<p>${__('failedToAdd', {count: result.failed})}</p>` : ''}
                <p><a href="${result.listUrl}" target="_blank">${__('viewList')}</a></p>
            `;
        } else {
            elements.followActionResultsContent.innerHTML = `
                <p>${__('failedToCreateList')}</p>
            `;
        }
        
        // Re-enable buttons
        elements.followButton.disabled = false;
        elements.createFollowListButton.disabled = false;
        elements.bothFollowButton.disabled = false;
        
    } catch (error) {
        showError(__('errorCreatingList', {message: error.message}));
        elements.followButton.disabled = false;
        elements.createFollowListButton.disabled = false;
        elements.bothFollowButton.disabled = false;
    }
}

// Handle both (create list and follow) action
async function handleBothFollow() {
    // Check if data is loaded, and load it if needed
    if (state.followersYouDontFollow.length === 0 && state.followers.length > 0 && state.follows.length > 0) {
        await loadFollowersYouDontFollow();
    }
    
    if (state.selectedFollowerIndices.size === 0) return;
    
    if (!confirm(__('confirmBothFollow', {count: state.selectedFollowerIndices.size}))) {
        return;
    }
    
    try {
        // First create the list
        elements.followActionTitle.textContent = __('createFollowListButton', {count: state.selectedFollowerIndices.size});
        showElement(elements.followActionProgress);
        hideElement(elements.followActionResults);
        
        elements.followButton.disabled = true;
        elements.createFollowListButton.disabled = true;
        elements.bothFollowButton.disabled = true;
        
        // Step 1: Create list
        const listResult = await createFollowListWithAccounts(
            state.followersYouDontFollow,
            state.selectedFollowerIndices,
            (progress) => {
                setProgressBar(elements.followActionProgressBar, progress);
            },
            (status) => {
                elements.followActionStatus.textContent = status;
            }
        );
        
        // Step 2: Follow accounts
        elements.followActionTitle.textContent = 'Following Accounts';
        elements.followActionStatus.textContent = 'Preparing to follow...';
        setProgressBar(elements.followActionProgressBar, 0);
        
        const followResult = await followSelected(
            state.followersYouDontFollow,
            state.selectedFollowerIndices,
            (progress) => {
                setProgressBar(elements.followActionProgressBar, progress);
            },
            (status) => {
                elements.followActionStatus.textContent = status;
            }
        );
        
        // Show combined results
        showElement(elements.followActionResults);
        elements.followActionResultsContent.innerHTML = `
            <h4>List Creation:</h4>
            ${listResult ? `
                <p>✅ List created successfully!</p>
                <p>✅ Added ${listResult.successful} accounts to the list</p>
                ${listResult.failed > 0 ? `<p>❌ Failed to add ${listResult.failed} accounts</p>` : ''}
                <p><a href="${listResult.listUrl}" target="_blank">View List on Bluesky</a></p>
            ` : `
                <p>❌ Failed to create list</p>
            `}
            
            <h4>Follow Results:</h4>
            <p>✅ Successfully followed: ${followResult.successful}</p>
            ${followResult.failed > 0 ? `<p>❌ Failed to follow: ${followResult.failed}</p>` : ''}
        `;
        
        // Re-enable buttons
        elements.followButton.disabled = false;
        elements.createFollowListButton.disabled = false;
        elements.bothFollowButton.disabled = false;
        
        // Reload data if any follows were successful
        if (followResult.successful > 0) {
            await reloadData();
            // Reload the followers you don't follow tab since it's changed
            loadFollowersYouDontFollow();
        }
        
    } catch (error) {
        showError(__('errorGeneric', {message: error.message}));
        elements.followButton.disabled = false;
        elements.createFollowListButton.disabled = false;
        elements.bothFollowButton.disabled = false;
    }
}