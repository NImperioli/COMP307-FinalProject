const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },

  email: {
    type: String,
    required: true,
    unique: true,
    validate: {
      validator: function (email) {
        return (
          email.endsWith("@mcgill.ca") ||
          email.endsWith("@mail.mcgill.ca")
        );
      },
      message: "Must use a McGill email",
    },
  },

  password: {
    type: String,
    required: true,
  },

  role: {
    type: String,
    enum: ["owner", "user"], // owner = prof/TA
    default: "user",
  },

  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model("User", UserSchema);

//TODO: auto assign role, other stuff
