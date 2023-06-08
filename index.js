const express = require("express");
const cors = require("cors");
require("dotenv").config();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const app = express();
const port = process.env.PORT || 5000;

// middleware
app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send("wow! it's Dancing");
});

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.beeiwwt.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    // create db
    const danceSchoolDB = client.db("danceSchoolDB");
    // user collection
    const userCollection = danceSchoolDB.collection("users");
    // class collection
    const classCollection = danceSchoolDB.collection("classes");

    //users operation
    app.post("/newUsers", async (req, res) => {
      const userInfo = req.body;
      const isExistingUser = await userCollection.findOne({
        email: userInfo.email,
      });
      if (isExistingUser) {
        return res.send({ message: "User already exists" });
      }
      const addUserInfo = await userCollection.insertOne(userInfo);
      res.send(addUserInfo);
    });
    // get all user
    app.get("/users", async (req, res) => {
      const allUser = await userCollection.find().toArray();
      res.send(allUser);
    });
    app.patch("/users/admin/:id", async (req, res) => {
      const id = req.params.id;
      const aspectRole = req.headers.role;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          role:
            aspectRole === "admin"
              ? "admin"
              : aspectRole === "instructor"
              ? "instructor"
              : "student",
        },
      };
      const updateUser = await userCollection.updateOne(filter, updateDoc);
      res.send(updateUser);
    });
    // delete user
    app.delete("/users/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const deleteUser = await userCollection.deleteOne(query);
      res.send(deleteUser);
    });

    // class operation
    app.post("/addClass", async (req, res) => {
      const classDetails = req.body;
      const addClass = await classCollection.insertOne(classDetails);
      res.send(addClass);
    });
    app.get("/classes/:email", async (req, res) => {
      const email = req.params?.email;
      const classes = await classCollection
        .find({ instructorEmail: email })
        .toArray();
      res.send(classes);
    });

    // set status of class
    app.patch("/classes/admin/:id", async (req, res) => {
      const id = req.params.id;
      const status = req.headers.status;
      console.log(id, status);
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          status:
            status === "approve"
              ? "approved"
              : status === "deny"
              ? "denied"
              : "pending",
        },
      };
      const updateStatus = await classCollection.updateOne(filter, updateDoc);
      res.send(updateStatus);
    });
    // all classes for by admin acess
    app.get("/classes", async (req, res) => {
      const classes = await classCollection.find().toArray();
      res.send(classes);
    });
    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.listen(port, () => {
  console.log("Dancing on port", port);
});
