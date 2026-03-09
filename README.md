# IoT Device Dashboard & Data Management System

โปรเจกต์ระบบจัดการอุปกรณ์ IoT และแดชบอร์ดแสดงผลข้อมูล (IoT Device Dashboard) พัฒนาด้วย React.js (Frontend) และ Node.js + MongoDB (Backend) ระบบนี้มีความสามารถในการจัดการตั้งค่าอุปกรณ์, รันสคริปต์จำลองเซนเซอร์แบบ Real-time, ปรับแต่งหน้าแดชบอร์ดด้วยการลากวาง (Drag & Drop), และระบบบันทึกข้อมูลย้อนหลัง (Data Logging) พร้อมแสดงผลผ่านกราฟ

## 🚀 เทคโนโลยีที่ใช้ (Tech Stack)
* **Frontend:** React.js, Material-UI (MUI), Recharts (สำหรับวาดกราฟ), React Router
* **Backend:** Node.js, gRPC (สำหรับการสื่อสารระหว่างระบบ), Mongoose
* **Database:** MongoDB

---

## 📅 บันทึกการอัปเดต (Changelog - 3 Weeks Update)

### สัปดาห์ที่ 3: ระบบกราฟ, การควบคุมเวลา และบันทึกประวัติ (ปัจจุบัน)
* **Real-time Chart Integration:** ติดตั้งไลบรารี `recharts` เพื่อวาดกราฟเส้น (Line Chart) แสดงข้อมูลเซนเซอร์แบบ Real-time โดยดึงเฉพาะค่าตัวเลขจาก Tag มาวาดอัตโนมัติ
* **Independent Update Intervals:** ปรับปรุงระบบรันสคริปต์ให้แต่ละ Tag สามารถตั้งเวลาอัปเดตแยกกันได้อย่างอิสระ (เช่น 1 วินาที, 15 วินาที, 30 วินาที, 1 นาที) โดยมีระบบนาฬิกากลางคอยควบคุม
* **Historical Data & Datetime Widget:** สร้างกล่องเครื่องมือปฏิทิน (Datetime) แบบลากวางได้ เพื่อใช้สำหรับเลือกวันที่ต้องการดูข้อมูลประวัติ (ล็อกไม่ให้เลือกวันที่ในอนาคต)
* **Auto Data Logger (Frontend Simulation):** พัฒนาระบบบันทึกข้อมูลอัตโนมัติ โดยหน้าเว็บจะทำการแพ็คข้อมูลจากแท็กที่เปิดสถานะ `Record` ไว้ ส่งไปบันทึกลง Database ทุกๆ 1 นาที
* **Backend Crash Fixes:** * แก้ไขปัญหา Server ดับเวลาบันทึกประวัติ โดยเพิ่มตาราง `HistoryData` ลงใน Schema Binding (`models`).
  * เปลี่ยนคำสั่งสร้างข้อมูลจาก `insertOne()` เป็นมาตรฐานของ Mongoose คือ `create()`
  * เพิ่มระบบ Safeguard ดักจับ Error ไม่ให้ Node.js ดับเมื่อมีคำขอที่ไม่ถูกต้อง
* **UI Clean up:** คอมเมนต์ปิดเมนูเครื่องมือที่ยังไม่พร้อมใช้งานในปัจจุบัน (Gauge, Map) เพื่อให้ UI ดูสะอาดตาและป้องกันความสับสน

### สัปดาห์ที่ 2: ระบบ Dashboard และการจัดการ Layout
* **Tabs Separation:** แยกระบบเป็น 2 หน้าต่างอย่างชัดเจนคือ `DEVICES` (สำหรับตั้งค่าข้อมูล) และ `DASHBOARD` (พื้นที่ทำงานแบบ Grid สำหรับแสดงผล)
* **Drag & Drop Dashboard:** พัฒนาระบบกระดานแดชบอร์ด ให้ผู้ใช้สามารถจับลากกล่อง Tag และ Chart ไปวางตามตำแหน่งต่างๆ (พิกัด X, Y) ได้อย่างอิสระ
* **Smart Save System:** * แยกลอจิกการบันทึกข้อมูล ถ้ายืนอยู่หน้า DASHBOARD จะบันทึกแค่ตำแหน่ง (Layout) แต่ถ้ายืนอยู่หน้า DEVICES จะบันทึกข้อมูลและเพิ่ม Tag ใหม่
  * สร้างระบบ **"Dirty Checker"** เพื่อป้องกันการงอก Tag เปล่า หากผู้ใช้กด Save โดยที่ไม่มีการแก้ไขข้อมูลใดๆ ระบบจะเด้งถามเพื่อยืนยันก่อน
* **Alarm Settings:** นำฟังก์ชันการตั้งค่า Alarm (Set Point Low/High, Critical Level) กลับมาแสดงผลและบันทึกลงฐานข้อมูลได้ตามปกติ

### สัปดาห์ที่ 1: โครงสร้างพื้นฐาน และระบบจัดการ Tag
* **UI Structure:** สร้างหน้ากากแบบฟอร์มการจัดการอุปกรณ์ (Device Form) ด้วย Material-UI (MUI) 
* **Tag Management System:** สร้างระบบเพิ่มและลบ Tag
* **Auto Re-order Indexing:** ปรับปรุงลอจิกการลบ Tag เมื่อทำการลบ Tag ตรงกลาง (เช่น ลบ Tag 2) ระบบจะทำการดึง Tag 3 ขึ้นมาแทนที่และเปลี่ยนชื่อ/ตัวเลขรันลำดับใหม่ให้เรียงกันอัตโนมัติ (1, 2, 3...) พร้อมเซฟลง Database ทันที
* **Script Engine:** สร้างระบบ `jsexe` โดยใช้ `new Function` สำหรับจำลองการทำงานของเซนเซอร์ผ่านการเขียน JavaScript สั้นๆ และแสดงผลลัพธ์ผ่าน Console Output ทันที

---

## ⚙️ โครงสร้างฐานข้อมูล (Database Schema)
* **`Device` Collection:** เก็บข้อมูลหลักของอุปกรณ์ (รหัส, ชื่อ, IP) รวมถึง Array ของ `tags` และพิกัดตำแหน่งของ Widget ต่างๆ บนแดชบอร์ด (`chartX`, `chartY`, `showChart`, ฯลฯ)
* **`HistoryData` Collection:** ตารางสำหรับเก็บประวัติ (Data Log) ประกอบด้วยรหัสอุปกรณ์, วันที่, เวลา, และ Object ที่เก็บค่าเซนเซอร์ ณ เวลานั้นๆ

---

## 🛠️ การติดตั้งและรันโปรเจกต์

**1. รัน Backend (Database & gRPC Server)**
```bash
cd backend
npm install
node db.js