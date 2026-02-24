const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const userSchema = new Schema({
  _id: String,
  userName: String,
  fullName: String,
  email: String,
  userLevel: String,
  userState: String,
  password: String,
  dateCreate: Date,
  dateExpire: Date,
})

// --- โครงสร้าง Tag แบบเต็มรูป ---
const tagSchema = new Schema({
  label: String,
  script: String,
  updateInterval: String, 
  record: Boolean,
  sync: Boolean,
  api: Boolean,
  line: Boolean,
  email: Boolean,
  // ส่วนของ Alarm
  alarm: String,
  spLow: String,
  spHigh: String,
  critical: String,
  title: String,
  alert: String,
  description: String,
  x: Number, // เก็บตำแหน่งแกน X แนวนอน
  y: Number  // เก็บตำแหน่งแกน Y แนวตั้ง
})

// --- โครงสร้าง Device แบบเต็มรูป ---
const deviceSchema = new Schema({
  _id: String,
  code: String,
  connection: String,
  model: String,
  ipAddr: String,
  name: String,
  remark: String,
  apiCode: String,
  lineChannel: String,
  lineId: String,
  emailFrom: String,
  emailPwd: String,
  emailTo: String,
  status: String,
  revision: Number, 
  tags: [tagSchema],
  showChart: Boolean, // เปิดกราฟทิ้งไว้
  chartX: Number,     // พิกัดแกน X ของกราฟ
  chartY: Number,     // พิกัดแกน Y ของกราฟ 
})

module.exports = {
  mongoose: mongoose,
  userSchema: userSchema,
  deviceSchema: deviceSchema,
}