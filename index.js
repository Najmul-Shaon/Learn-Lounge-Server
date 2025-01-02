const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const express = require("express");
const cors = require("cors");
const app = express();
require("dotenv").config();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.cwzf5.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

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
    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );

    //   assignments api
    const assignmentsCollection = client
      .db("learnLoungeDB")
      .collection("assignments");

    app.post("/assignments", async (req, res) => {
      const newAssignment = req.body;
      const result = await assignmentsCollection.insertOne(newAssignment);
      res.send(result);
      console.log(newAssignment);
    });

    //   get assignment
    app.get("/assignments", async (req, res) => {
      const result = await assignmentsCollection.find().toArray();
      res.send(result);
    });

    //   get single (specific by id) assignment
    app.get("/assignment/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await assignmentsCollection.findOne(query);
      res.send(result);
    });

    // get my submitted assignment by userMail
    app.get("/assignments/submitted", async (req, res) => {
      const email = req.query.email;
      const query = { userMail: email };
      const result = await submitCollection.find(query).toArray();
      // find by assignment id
      for (const assignment of result) {
        console.log(assignment.assignmentId);
        const assignmentQuery = { _id: new ObjectId(assignment.assignmentId) };
        const finalResult = await assignmentsCollection.findOne(
          assignmentQuery
        );
        if (finalResult) {
          assignment.title = finalResult.title;
          assignment.marks = finalResult.marks;
        }
      }
      res.send(result);
    });

    // create pending assignment api
    app.get("/assignments/pending", async (req, res) => {
      const query = { "assignmentInfo.isPending": true };
      const result = await submitCollection.find(query).toArray();
      for (const pendingAssignmentDetails of result) {
        console.log(pendingAssignmentDetails.userMail);

        const pendingAssignmentQuery = {
          _id: new ObjectId(pendingAssignmentDetails.assignmentId),
        };

        const finalResultOfAssignmentInfo = await assignmentsCollection.findOne(
          pendingAssignmentQuery
        );

        const pendingAssignmentUserQuery = {
          email: pendingAssignmentDetails.userMail,
        };

        const finalResultOfUserName = await usersCollection.findOne(
          pendingAssignmentUserQuery
        );

        if (finalResultOfAssignmentInfo) {
          pendingAssignmentDetails.title = finalResultOfAssignmentInfo.title;
          pendingAssignmentDetails.marks = finalResultOfAssignmentInfo.marks;
          pendingAssignmentDetails.name = finalResultOfUserName.name;
        }
      }
      res.send(result);
    });

    //   update assignment by id
    app.put("/assignment/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const options = { upsert: true };
      const updatedAssignment = req.body;
      const newAssignment = {
        $set: {
          title: updatedAssignment.title,
          phoroUrl: updatedAssignment.phoroUrl,
          marks: updatedAssignment.marks,
          description: updatedAssignment.description,
          type: updatedAssignment.type,
          formatedDeadline: updatedAssignment.formatedDeadline,
          userName: updatedAssignment.userName,
          userMail: updatedAssignment.userMail,
        },
      };
      const result = await assignmentsCollection.updateOne(
        filter,
        newAssignment,
        options
      );
      res.send(result);
    });

    //   submit assignment
    const submitCollection = client
      .db("learnLoungeDB")
      .collection("submitedAssignments");

    app.post("/assignment/submit", async (req, res) => {
      const submittedAssignment = req.body;
      console.log(submittedAssignment);
      const result = await submitCollection.insertOne(submittedAssignment);
      res.send(result);
    });

    //   delete assignment
    app.delete("/assignment/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await assignmentsCollection.deleteOne(query);
      res.send(result);
    });

    //   users api
    const usersCollection = client.db("learnLoungeDB").collection("users");

    app.post("/users", async (req, res) => {
      const newUser = req.body;
      console.log("creating new user", newUser);
      const result = await usersCollection.insertOne(newUser);
      res.send(result);
    });
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send(`server is running at ${port}}`);
});

app.listen(port, () => {
  console.log("server running");
});
