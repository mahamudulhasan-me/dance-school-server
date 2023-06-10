const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
require("dotenv").config();
const stripe = require("stripe")(process.env.PAYMENT_SECRET_KEY);

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const app = express();
const port = process.env.PORT || 5000;

// middleware
app.use(cors());
app.use(express.json());

const verifyJWT = (req, res, next) => {
  const authorization = req.headers.authorization;
  if (!authorization) {
    return res
      .status(401)
      .send({ error: true, message: "Authentication required 1" });
  }
  const token = authorization.split(" ")[1];
  jwt.verify(token, process.env.JWT_SIGNATURE, (error, decode) => {
    if (error) {
      return res
        .status(401)
        .send({ error: true, message: "Authorization required 2" });
    }
    req.decoded = decode;
    next();
  });
};

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
    // selected class collection
    const selectedClassCollection = danceSchoolDB.collection("selectedClasses");
    // payment collection
    const paymentCollection = danceSchoolDB.collection("payments");
    // post jwt token
    app.post("/jwt", (req, res) => {
      const email = req.body;
      const token = jwt.sign(email, process.env.JWT_SIGNATURE, {
        expiresIn: "1h",
      });
      res.send(token);
    });

    // after jwt verification now check this user is admin/instructor is or not
    // verifyAdmin
    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const getAdmin = await userCollection.findOne(query);
      if (getAdmin?.role !== "admin") {
        return res
          .status(403)
          .send({ error: true, message: "Forbidden Access 3" });
      }
      next();
    };
    //verifyInstructor
    const verifyInstructor = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const aspectInstructor = await userCollection.findOne(query);
      if (aspectInstructor?.role !== "instructor") {
        return res
          .status(403)
          .send({ error: true, message: "Forbidden Access 4" });
      }
      next();
    };
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
    app.get("/users", verifyJWT, verifyAdmin, async (req, res) => {
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
    // check user isAdmin
    app.get("/users/admin/:email", verifyJWT, async (req, res) => {
      const email = req.params.email;
      const decodedEmail = req.decoded.email;
      if (email !== decodedEmail) {
        return res.send({ admin: false });
      }
      const query = { email: email };
      const user = await userCollection.findOne(query);
      const isAdmin = { admin: user?.role === "admin" };
      res.send(isAdmin);
    });

    //check user isInstructor
    app.get("/users/instructor/:email", verifyJWT, async (req, res) => {
      const email = req.params.email;
      const decodedEmail = req.decoded.email;
      if (email !== decodedEmail) {
        return res.send({ instructor: false });
      }
      const query = { email: email };
      const user = await userCollection.findOne(query);
      const isAdmin = { instructor: user?.role === "instructor" };
      res.send(isAdmin);
    });
    // delete user
    app.delete("/users/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const deleteUser = await userCollection.deleteOne(query);
      res.send(deleteUser);
    });

    // class operation
    app.post("/addClass", verifyJWT, verifyInstructor, async (req, res) => {
      const classDetails = req.body;
      const addClass = await classCollection.insertOne(classDetails);
      res.send(addClass);
    });
    app.get(
      "/classes/:email",
      verifyJWT,
      verifyInstructor,
      async (req, res) => {
        const email = req.params?.email;
        const classes = await classCollection
          .find({ instructorEmail: email })
          .toArray();
        res.send(classes);
      }
    );

    // set status of class
    app.patch("/classes/admin/:id", async (req, res) => {
      const id = req.params.id;
      const status = req.headers.status;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          status:
            status === "approve"
              ? "approved"
              : status === "deny"
              ? "denied"
              : "pending",
          feedback: req?.body,
        },
      };
      const updateStatus = await classCollection.updateOne(filter, updateDoc);
      res.send(updateStatus);
    });
    app.patch("/classes/feedback/admin/:id", async (req, res) => {
      const id = req.params.id;
      const feedback = req.headers?.feedback;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          feedback: feedback ? feedback : "N/A",
        },
      };
      const updateFeedback = await classCollection.updateOne(filter, updateDoc);
      res.send(updateFeedback);
    });
    // all classes for by admin access
    app.get("/classes", verifyJWT, verifyAdmin, async (req, res) => {
      const classes = await classCollection.find().toArray();
      res.send(classes);
    });

    // get all approve class
    app.get("/approvedClasses", async (req, res) => {
      const query = { status: "approved" };
      const approvedClasses = await classCollection.find(query).toArray();
      res.send(approvedClasses);
    });
    // class add on cart
    app.post("/selectClass", async (req, res) => {
      const classInfo = req.body;
      const classId = classInfo.classId;
      const email = classInfo.studentEmail;
      const isAlreadySelected = await selectedClassCollection.findOne({
        classId: classId,
        studentEmail: email,
      });
      if (isAlreadySelected) {
        return res.send({ message: "Class already selected" });
      }
      const addClass = await selectedClassCollection.insertOne(classInfo);
      res.send(addClass);
    });
    app.get("/selectedClass/:email", verifyJWT, async (req, res) => {
      const email = req.params.email;
      const filter = { studentEmail: email };
      const decodedEmail = req.decoded.email;

      if (email !== decodedEmail) {
        return res
          .status(403)
          .send({ error: true, message: "Forbidden Access" });
      }
      const selectedClasses = await selectedClassCollection
        .find(filter)
        .toArray();
      res.send(selectedClasses);
    });
    app.delete("/selectedClass/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };

      const removeClass = await selectedClassCollection.deleteOne(query);
      res.send(removeClass);
    });

    // create payment intent
    app.post("/create-payment-intent", verifyJWT, async (req, res) => {
      const { price } = req.body;
      const amount = price * 100;

      const paymentMethod = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        payment_method_types: ["card"],
      });

      res.send({
        clientSecret: paymentMethod.client_secret,
      });
    });

    // payment
    app.post("/payments", verifyJWT, async (req, res) => {
      const payment = req.body;
      const insertedResult = await paymentCollection.insertOne(payment);

      // delete the selected classes
      const selectedClassIds = payment.selectedClassesId.map(
        (id) => new ObjectId(id)
      );
      const query = { _id: { $in: selectedClassIds } };
      const deletedResult = await selectedClassCollection.deleteMany(query);

      // Update the class documents
      const classIds = payment.classesId.map((id) => new ObjectId(id));
      const updateQuery = { _id: { $in: classIds } };
      const updateOperation = {
        $inc: { enrolledStudent: 1, availableSeat: -1 },
      };
      const updateResult = await classCollection.updateMany(
        updateQuery,
        updateOperation
      );

      res.send({ insertedResult, deletedResult, updateResult });
    });

    // get payment history
    app.get("/payment/:email", async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const result = await paymentCollection
        .find(query)
        .sort({ date: -1 })
        .toArray();
      res.send(result);
    });
    app.get("/enrolled-classes/:email", async (req, res) => {
      const email = req.params.email;

      // Find the enrolled classes for the student in the payment collection
      const paymentQuery = { email: email };
      const enrolledClasses = await paymentCollection
        .find(paymentQuery)
        .toArray();

      // Extract the class IDs from the enrolled classes
      let classIds = [];
      enrolledClasses.forEach((payment) => {
        classIds = classIds.concat(payment.classesId.flat());
      });

      // Find the corresponding classes in the class collection
      const classQuery = {
        _id: { $in: classIds.map((id) => new ObjectId(id)) },
      };
      const enrolledClassDetails = await classCollection
        .find(classQuery)
        .toArray();

      res.send(enrolledClassDetails);
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
