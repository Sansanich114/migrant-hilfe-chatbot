// server/models/User.js
import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const SALT_WORK_FACTOR = 10;

const UserSchema = new mongoose.Schema({
  email: { type: String, unique: true, required: true },
  password: { type: String, required: true },
  isVerified: { type: Boolean, default: false },
  subscriptionType: { type: String, default: "free" },
  freeUsageCount: { type: Number, default: 0 },
  profileInfo: { type: Object, default: {} },
  createdAt: { type: Date, default: Date.now },
});

// Pre-save hook to hash password if modified
UserSchema.pre("save", function (next) {
  const user = this;
  if (!user.isModified("password")) return next();

  bcrypt.genSalt(SALT_WORK_FACTOR, function (err, salt) {
    if (err) return next(err);
    bcrypt.hash(user.password, salt, function (err, hash) {
      if (err) return next(err);
      user.password = hash;
      next();
    });
  });
});

// Method to compare candidate password
UserSchema.methods.comparePassword = function (candidatePassword, cb) {
  bcrypt.compare(candidatePassword, this.password, function (err, isMatch) {
    if (err) return cb(err);
    cb(null, isMatch);
  });
};

const User = mongoose.model("User", UserSchema);
export default User;
