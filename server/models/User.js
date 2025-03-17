// server/models/User.js
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const SALT_WORK_FACTOR = 10;

const UserSchema = new mongoose.Schema({
  email: { type: String, unique: true, required: true },
  // username removed entirely
  password: { type: String, required: true },
  isVerified: { type: Boolean, default: false },
  subscriptionType: { type: String, default: "free" },
  freeUsageCount: { type: Number, default: 0 },
  profileInfo: { type: Object, default: {} },
  createdAt: { type: Date, default: Date.now }
});

// Pre-save hook to hash password if modified
UserSchema.pre("save", function(next) {
  const user = this;
  if (!user.isModified("password")) return next();
  bcrypt.genSalt(SALT_WORK_FACTOR, function(err, salt) {
    if (err) return next(err);
    bcrypt.hash(user.password, salt, function(err, hash) {
      if (err) return next(err);
      user.password = hash;
      next();
    });
  });
});

// Method to compare candidate password
UserSchema.methods.comparePassword = function(candidatePassword, cb) {
  bcrypt.compare(candidatePassword, this.password, function(err, isMatch) {
    if (err) return cb(err);
    cb(null, isMatch);
  });
};

module.exports = mongoose.model("User", UserSchema);
