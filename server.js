const axios = require('axios');
const PubSub = require('@google-cloud/pubsub');

const pubsub = new PubSub();
const perPage = 100;
const topicName = 'githubPushEvents';
const topic = pubsub.topic(topicName);
const publisher = topic.publisher();

async function poll(tailId) {

  // Fetch all public GitHub events.  We can only grab 100 at a time.
  const url = `https://api.github.com/events?per_page=${perPage}`;
  const res = await axios(url, {
    headers: {
      'Authorization': `token ${process.env.UPTODATE_GITHUB_TOKEN}`
    }
  });

  // Make sure were not running out of API calls.
  const remaining = res.headers['x-ratelimit-remaining'];
  if (remaining <= 0) {
    console.log(`We are out of requests to the GitHub API!`)
  }

  // Assume that we're going to get a lot of overlapping data.
  // Trip the list to only include new IDs we haven't seen before.
  const ids = res.data.map(x => x.id);
  const firstId = ids[0];
  const iom = ids.indexOf(tailId);
  const events = res.data.slice(0, iom);

  // If the trimmed list is the same as the page size, there are more
  // than 100 events every 0.75 seconds 👻
  if (iom === perPage) {
    console.log(`Too many results returned, we are losing data.`);
  }

  // Iterate through each public event, and publish PushEvent type
  // through the pubsub topic.  Something else will do stuff with em.
  events.forEach(async x => {
    if (x.type === 'PushEvent') {
      const messageId = await publisher.publish(Buffer.from(JSON.stringify(x)));
      console.log(`${x.id}:${messageId}`);
    }
  });
  console.log('---');

  // GitHub provides 5000 API calls per hour.  That works out to about one
  // every 720 milliseconds.  Poll on 750 to be as aggressive as possible.
  setTimeout(() => {
    poll(firstId);
  }, 750);
}

poll().catch(console.error);
