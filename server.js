const axios = require('axios');
const PubSub = require('@google-cloud/pubsub');

const pubsub = new PubSub();
const perPage = 100;
const topicName = 'githubPushEvents';
const topic = pubsub.topic(topicName);
const publisher = topic.publisher();

async function poll(tailId) {
  const url = `https://api.github.com/events?per_page=${perPage}`;
  const res = await axios(url, {
    headers: {
      'Authorization': `token ${process.env.UPTODATE_GITHUB_TOKEN}`
    }
  });

  const remaining = res.headers['x-ratelimit-remaining'];
  if (remaining <= 0) {
    console.log(`We are out of requests to the GitHub API!`)
  }

  const ids = res.data.map(x => x.id);
  const firstId = ids[0];
  const iom = ids.indexOf(tailId);

  if (iom === perPage) {
    console.log(`Too many results returned, we are losing data.`);
  }

  const events = res.data.slice(0, iom);
  events.forEach(async x => {
    const messageId = await publisher.publish(Buffer.from(JSON.stringify(x)));
    console.log(`${x.id}:${messageId}`);
  });
  console.log('---');

  setTimeout(() => {
    poll(firstId);
  }, 750);
}

poll().catch(console.error);
