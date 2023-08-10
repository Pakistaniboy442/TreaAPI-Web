const { Client } = require('discord.js-selfbot-v13');
const express = require('express');
const fs = require('fs');
const app = express();
const client = new Client({
  checkUpdate: false,
});
const path = require('path')
const bodyParser = require('body-parser');
const NodeCache = require('node-cache');
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
client.on('ready', async () => {
  let blacklistedWords = new Set();

  // Read the filter.txt file only once during server startup
  fs.readFile('filter.txt', 'utf8', (err, data) => {
      if (err) {
          console.error('Error reading filter.txt:', err);
      } else {
          blacklistedWords = new Set(data.split('\n').map(word => word.trim()));
      }
  });
  
  const channel = client.channels.cache.get('1136862448486461584');
  console.log(`${client.user.username} is ready!`);
  
  app.get('/', async (req, res) => {
    const file = fs.readFileSync('./views/index.html', { encoding: 'utf8' })
    res.setHeader('Content-Type', 'text/html');
    res.send(file)
  })

  app.post('/api/send', async (req, res) => {
    const sentMessage = req.body.messagedata;
    
    // Check if the sent message contains any blacklisted words
    const wordsInMessage = sentMessage.split(/\s+/);
    const hasBlacklistedWord = wordsInMessage.some(word => blacklistedWords.has(word));
    
    if (hasBlacklistedWord) {
      res.status(400).json({ message: 'Blacklisted word detected' });
      return;
    }
    
    // If no blacklisted words found, send the message
    try {
        await channel.send({ content: `${sentMessage}` });
        res.redirect('/');
        console.log(sentMessage);
    } catch (error) {
        console.error('Error sending message:', error);
        res.status(500).send('Error sending message');
    }
});
  
  const cache = new NodeCache({ stdTTL: 10 });

  app.get('/api/getMessages', async (req, res) => {
    try {
        const pageSize = 5;

        // Check if messages are already cached
        const cachedMessages = cache.get('cachedMessages');
        if (cachedMessages) {
            res.json(cachedMessages);
        } else {
            const messages = await channel.messages.fetch({ limit: pageSize });

            const messageContents = [];

            for (const message of messages.values()) {
                const result = {
                    author: {
                        username: message.author.username,
                        id: message.author.id
                    },
                    content: message.content
                };

                // Check for attachments
                if (message.attachments.size > 0) {
                    const attachment = message.attachments.first();
                    const attachmentLink = attachment.url;
                    result.attachmentLink = attachmentLink;
                }

                // Check for embeds
                if (message.embeds.length > 0) {
                    const embed = message.embeds[0];
                    if (embed.description) {
                        result.description = embed.description;
                        result.embed = true;
                    }
                    if (embed.title) {
                        result.title = embed.title;
                    }
                    if (embed.footer && embed.footer.text) {
                        result.footer = embed.footer.text;
                    }
                    if (embed.image && embed.image.url) {
                        // If an image URL is found within the embed, use it as an attachment link
                        result.attachmentLink = embed.image.url;
                    }
                }

                messageContents.push(result);
            }

            // Cache the fetched messages
            cache.set('cachedMessages', messageContents);
            res.json(messageContents);
        }
    } catch (error) {
        console.error('Error fetching messages:', error);
        res.status(500).send('Error fetching messages');
    }
});


  });

  client.on('messageCreate', async message => {
    if (message.content.startsWith('!help')) {
        // Extract the content of the message to send
        const content = message.content.replace('!sendmessage', '').trim();

        try {
            // Send a new message to the same channel
            const sentMessage = await message.channel.send('No Help');
            console.log(`Message sent: "${content}"`);
        } catch (error) {
            console.error('Error sending message:', error);
        }
    }
});
  app.use('/public', express.static(path.join(__dirname + '/public/')));
client.login('');
app.listen(3000, function() {
    console.log(`Hey, server is running on port http://127.0.0.1:3000`)
})

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});