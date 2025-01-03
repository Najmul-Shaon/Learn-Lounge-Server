const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const express = require("express");
const cors = require("cors");
const app = express();
require("dotenv").config();
const port = process.env.PORT || 5000;

app.use(
  cors({
    origin: ["http://localhost:5173"],
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());

const verifyToken = (req, res, next) => {
  // const token = res.cookies?.token;
  const token = req.cookies?.token;

  if (!token) {
    return res
      .status(401)
      .send({ message: "unauthorized access from outside" });
  }

  jwt.verify(token, process.env.ACCESS_TOKEN, (error, decoded) => {
    if (error) {
      return res
        .status(401)
        .send({ message: "unauthorized access from nested" });
    }

    req.user = decoded;

    next();
  });

  console.log(token);
};

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

    // auth related api
    app.post("/jwt", (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN, {
        expiresIn: "1h",
      });

      res
        .cookie("token", token, { httpOnly: true, secure: false })
        .send({ success: true });
    });

    app.post("/logout", (req, res) => {
      res
        .clearCookie("token", {
          httpOnly: true,
          secure: false,
        })
        .send({ success: true });
    });
    //   assignments api
    const assignmentsCollection = client
      .db("learnLoungeDB")
      .collection("assignments");
    // create assignment
    app.post("/assignments", verifyToken, async (req, res) => {
      const newAssignment = req.body;
      const result = await assignmentsCollection.insertOne(newAssignment);
      res.send(result);
    });

    //   get assignment
    app.get("/assignments", async (req, res) => {
      const result = await assignmentsCollection.find().toArray();
      res.send(result);
    });

    //   get single (specific by id) assignment for assignment details
    app.get("/assignment/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await assignmentsCollection.findOne(query);
      res.send(result);
    });

    // get my submitted assignment by userMail
    app.get("/assignments/submitted", verifyToken, async (req, res) => {
      const email = req.query.email;
      const query = { userMail: email };

      // console.log(req.cookies?.token);

      if (req.user.email !== req.query.email) {
        return res.status(403).send({ message: "forbidden access" });
      }

      const result = await submitCollection.find(query).toArray();
      // find by assignment id
      for (const assignment of result) {
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
    app.get("/assignments/pending", verifyToken, async (req, res) => {
      const query = { "assignmentInfo.isPending": true };
      const result = await submitCollection.find(query).toArray();
      for (const pendingAssignmentDetails of result) {
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
          pendingAssignmentDetails.title = finalResultOfAssignmentInfo?.title;
          pendingAssignmentDetails.marks = finalResultOfAssignmentInfo?.marks;
          pendingAssignmentDetails.name = finalResultOfUserName?.name;
        }
      }
      res.send(result);
    });

    // assignment mark, feedback and status update api
    app.patch("/assignment/update/:id", async (req, res) => {
      const id = req.params.id;
      const data = req.body;
      const filter = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: {
          "assignmentInfo.isPending": data.isPending,
          "assignmentInfo.obtainMark": data.obtainMark,
          "assignmentInfo.feedback": data.feedback,
        },
      };
      const result = await submitCollection.updateMany(filter, updatedDoc);
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
