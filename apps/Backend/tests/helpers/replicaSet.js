const { MongoClient } = require("mongoose").mongo;

// Each suite starts its own mongod. A one-member replica set is enough for
// isolated transaction tests; it is not a production HA recommendation.
async function initiateReplicaSet(port) {
  const client = new MongoClient(`mongodb://127.0.0.1:${port}/?directConnection=true`);
  try {
    await client.connect();
    await client.db("admin").command({ replSetInitiate: {
      _id: "paymentTests", members: [{ _id: 0, host: `127.0.0.1:${port}` }],
    } });
    for (let attempt = 0; attempt < 100; attempt++) {
      if ((await client.db("admin").command({ hello: 1 })).isWritablePrimary) return;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    throw new Error("Test replica set did not elect a primary");
  } finally { await client.close(); }
}
module.exports = { initiateReplicaSet };
