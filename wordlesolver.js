const { Client, GatewayIntentBits, ActivityType } = require('discord.js');
const fs = require('fs');
const TOKEN = 'Bot token'; //Put ur token in here twin <3

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
});

let originalWords = fs.readFileSync('words.txt', 'utf-8')
    .split('\n')
    .map(w => w.trim().toLowerCase())
    .filter(w => w.length === 5 && /^[a-z]{5}$/.test(w)); // 5 chr checker

let sessions = {};

// Looks at the words and counts the frequency of each letter
function scoreWord(word) {
    const letterFreq = {};
    for (const word of words) {
        const unique = new Set(word);
        for (const ch of unique) {
            letterFreq[ch] = (letterFreq[ch] || 0) + 1;
        }
    }

    return words.map(word => {
        const unique = new Set(word);
        let score = 0;
        for (const ch of unique) score += letterFreq[ch];
        if (unique.size === 5) score += 5;
        return { word, score };
    }).sort((a, b) => b.score - a.score).map(e => e.word);
}


// Fix the dog shit math and functions 
function filterWords(words, guess, result) {
    return words.filter(word => {
        const requiredCounts = {};
        for (let i = 0; i < 5; i++) {
            if (result[i] === '1' || result[i] === '2') {
                requiredCounts[guess[i]] = (requiredCounts[guess[i]] || 0) + 1;
            }
        }

        const wordCounts = {};
        for (const ch of word) {
            wordCounts[ch] = (wordCounts[ch] || 0) + 1;
        }

        for (let i = 0; i < 5; i++) {
            if (result[i] === '2' && word[i] !== guess[i]) return false;
        }

        for (let i = 0; i < 5; i++) {
            const g = guess[i];
            const r = result[i];

            if (r === '1') {
                if (word[i] === g) return false;
                if (!word.includes(g)) return false;
            } else if (r === '0') {
                if (wordCounts[g] > (requiredCounts[g] || 0)) return false;
            }
        }

        for (const letter in requiredCounts) {
            if ((wordCounts[letter] || 0) < requiredCounts[letter]) return false;
        }

        return true;
    });
}

client.on('messageCreate', (msg) => {
    if (msg.author.bot) return;
    const userId = msg.author.id;
    const content = msg.content.trim().toLowerCase();

    if (content === '.start') {
        const words = [...originalWords];
        const guess = words[Math.floor(Math.random() * words.length)];
        sessions[userId] = {
            words,
            lastGuess: guess,
            lastResult: null,
            history: []
        };
        msg.reply(`✅ Wordle session started!\nYour first guess is: \`${guess}\`\nNow reply with the result (e.g. \`01210\`) based on Wordle colors.`);
        return;
    }

    if (content === '.restart') {
        if (sessions[userId]) {
            const words = [...originalWords];
            const guess = words[Math.floor(Math.random() * words.length)];
            sessions[userId] = {
                words,
                lastGuess: guess,
                lastResult: null,
                history: []
            };
            msg.reply(`🔁 Session restarted!\nNew guess: \`${guess}\`\nReply with the result like \`00211\`.`);
        } else {
            msg.reply('⚠️ You haven’t started a session yet. Use `.start` first.');
        }
        return;
    }

    if (content === '.help') {
        msg.reply(`🟨 **Solver usage Help** 🟩


    **Commands:**
    • \`.start\` — Start the solver.
    • \`.restart\` — Restart the solver.
    • \`.edit\` — If you made a mistake, edit your last input.
    • \`.solved\` — Show the last guess / solved word.
    • \`.help\` — Command list and usage.

    **How to Use:**
    1. Type \`.start\` to begin.
    2. The solver will give you a word (like \`speed\`).
    3. Play Wordle and reply with the result using 0, 1, 2:
    - 0 = Not in the word ❌  
    - 1 = Wrong spot but in the word 🔄  
    - 2 = In the correct spot ✅

    Example: If you guessed \`speed\` and Wordle showed:
    🟩⬛🟨⬛⬛ → reply with: \`20100\``);
            return;
        }

        if (content === '.edit') {
            const session = sessions[userId];
            if (!session || session.history.length === 0) {
                msg.reply("⚠️ There's nothing to edit. Start with `.start`.");
                return;
            }

            const last = session.history.pop();
            session.words = last.words;
            session.lastGuess = last.guess;
            session.lastResult = null;

            msg.reply(`✏️ Last input discarded.\nYour guess is still: \`${session.lastGuess}\`\nPlease reply again with a new result (e.g. \`02100\`).`);
            return;
        }

        if (content === '.solved') {
            const session = sessions[userId];
            if (!session) {
                msg.reply('⚠️ No active session. Use `.start` first.');
                return;
            }
            if (!session.lastGuess) {
                msg.reply('⚠️ No guess found in your session.');
                return;
            }
            msg.reply(`🎉 YAY! The last word is: \`${session.lastGuess}\``);
            return;
        }

        const resultPattern = /^[012]{5}$/;
        if (resultPattern.test(content)) {
            if (!sessions[userId]) {
                msg.reply('⚠️ Start a session with `.start` first.');
                return;
            }

            const session = sessions[userId];
            session.history.push({
                words: [...session.words],
                guess: session.lastGuess,
                result: content
            });
            session.lastResult = content;

            const filtered = filterWords(session.words, session.lastGuess, content);

            if (filtered.length === 0) {
                msg.reply(`❌ No matching words left! Do \`.restart\` to reset.`);
                return;
            }

            let newGuess;
            if (filtered.length === 1) {
                newGuess = filtered[0];
                msg.reply(`🎉 YAY! The last word is: \`${newGuess}\``);
            } else {
                const candidates = filtered.filter(w => w !== session.lastGuess);
                newGuess = candidates.length > 0 ? candidates[Math.floor(Math.random() * candidates.length)] : session.lastGuess;
            }

            session.words = filtered;
            session.lastGuess = newGuess;

            if (filtered.length > 1) {
                msg.reply(`🤔 Words left: ${filtered.length}\nNext guess: \`${newGuess}\`\nReply with the values "0" "1" "2"`);
            }
            return;
        }

        if (sessions[userId]) {
            if (content === '.stop') {
                if (sessions[userId]) {
                    delete sessions[userId];
                    msg.reply('🟥 Session stopped.');
                } else {
                    msg.reply('⚠️ No active session');
                }
                return;
            }

            msg.reply(`❓ Invalid input. \`.edit\` to undo your last input.`);
        }
    });

    client.once('ready', () => {
        console.log(`✅ Logged in as ${client.user.tag}`);
        client.user.setPresence({
            status: 'online',
            activities: [{
                name: 'Wordle',
                type: ActivityType.Playing,
            }],
        });
    });

    client.login(TOKEN);

    client.on('error', (error) => {
        console.error('❌ WebSocket error:', error);
    });