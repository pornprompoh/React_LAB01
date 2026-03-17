// ========================================
// Script Scheduler (Background Task)
// ทำหน้าที่ตั้งเวลารันสคริปต์อัตโนมัติ
// ========================================

const { executeScript } = require('./scriptRunner');
const db = require('../db-client');

class ScriptScheduler {
  constructor() {
    this.jobs = new Map(); // เก็บ interval IDs
    this.isInitialized = false;
  }

  /**
   * Start scheduler and load all devices from database
   */
  async initialize() {
    try {
      console.log('🔄 Initializing Script Scheduler...');

      // ดึงข้อมูล Device ทั้งหมด
      const response = await db.readDocument({
        collection: 'Device',
        query: JSON.stringify({})
      });

      let devices = [];
      if (response && response.data) {
        try {
          const parsed = JSON.parse(response.data);
          devices = Array.isArray(parsed) ? parsed : [];
        } catch (e) {
          console.warn('⚠️  Failed to parse devices:', e.message);
        }
      }

      // สำหรับแต่ละ Device สร้าง scheduler
      devices.forEach(device => {
        if (!device.tags || !Array.isArray(device.tags)) return;

        device.tags.forEach((tag, index) => {
          if (tag.script && tag.script.trim()) {
            this.scheduleTag(device._id, index, tag);
          }
        });
      });

      this.isInitialized = true;
      console.log('✅ Script Scheduler initialized with', this.jobs.size, 'tasks');
    } catch (error) {
      console.error('❌ Scheduler Init Error:', error.message);
    }
  }

  /**
   * Schedule a single tag for execution at intervals
   */
  scheduleTag(deviceId, tagIndex, tag) {
    if (!tag.script || !tag.script.trim()) {
      return;
    }

    const jobKey = `${deviceId}_${tagIndex}`;
    const intervalMs = this.getIntervalMs(tag.updateInterval);

    // ลบ job เก่า ถ้ามี
    if (this.jobs.has(jobKey)) {
      clearInterval(this.jobs.get(jobKey));
    }

    // สร้าง interval ใหม่
    const intervalId = setInterval(async () => {
      try {
        const { success, result, error } = await executeScript(tag.script);

        if (success) {
          console.log(`  ✅ [${deviceId}] Tag ${tagIndex} (${tag.label}): ${result}`);
          // บันทึก result ไปยัง database หรือ broadcast ไป frontend ฯลฯ
        } else {
          console.warn(`  ⚠️  [${deviceId}] Tag ${tagIndex}: ${error}`);
        }
      } catch (err) {
        console.error(`  ❌ [${deviceId}] Tag ${tagIndex} Error:`, err.message);
      }
    }, intervalMs);

    this.jobs.set(jobKey, intervalId);
  }

  /**
   * Convert interval string to milliseconds
   */
  getIntervalMs(intervalStr) {
    const intervals = {
      '1sec': 1000,
      '15sec': 15000,
      '30sec': 30000,
      '1min': 60000,
      'daily': 86400000,
      'week': 604800000,
      'month': 2592000000,
      'year': 31536000000
    };
    return intervals[intervalStr] || 1000;
  }

  /**
   * Stop all scheduled jobs
   */
  stopAll() {
    this.jobs.forEach((intervalId) => clearInterval(intervalId));
    this.jobs.clear();
    console.log('⏹️  All scheduled tasks stopped');
  }

  /**
   * Get status of scheduler
   */
  getStatus() {
    return {
      isInitialized: this.isInitialized,
      totalJobs: this.jobs.size,
      jobKeys: Array.from(this.jobs.keys())
    };
  }
}

module.exports = new ScriptScheduler();
