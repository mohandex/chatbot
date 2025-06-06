require('dotenv').config();
const { Bot } = require("grammy");
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// ایجاد یا اتصال به پایگاه داده SQLite
const dbPath = path.join(__dirname, 'messages.db');
const db = new sqlite3.Database(dbPath);

// ایجاد جدول پیام‌ها اگر وجود نداشته باشد
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    message_id INTEGER NOT NULL,
    chat_id TEXT NOT NULL,
    user_id INTEGER NOT NULL,
    text TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(message_id, chat_id)
  )`);
});

// تابع برای ذخیره پیام در پایگاه داده
function saveMessage(messageId, chatId, userId, text) {
  return new Promise((resolve, reject) => {
    const stmt = db.prepare(`INSERT OR REPLACE INTO messages (message_id, chat_id, user_id, text) VALUES (?, ?, ?, ?)`);
    stmt.run([messageId, chatId, userId, text], function(err) {
      if (err) {
        reject(err);
      } else {
        resolve(this.lastID);
      }
    });
    stmt.finalize();
  });
}

// تابع برای دریافت پیام از پایگاه داده
function getMessage(messageId, chatId) {
  return new Promise((resolve, reject) => {
    db.get(`SELECT * FROM messages WHERE message_id = ? AND chat_id = ?`, [messageId, chatId], (err, row) => {
      if (err) {
        reject(err);
      } else {
        resolve(row);
      }
    });
  });
}

// توکن ربات خود را در اینجا قرار دهید
// اطمینان حاصل کنید که این توکن محرمانه باقی بماند و در کنترل نسخه به اشتراک گذاشته نشود.
const botToken = process.env.BOT_TOKEN || "YOUR_BOT_TOKEN";

if (botToken === "YOUR_BOT_TOKEN") {
  console.error("خطا: توکن ربات تنظیم نشده است. لطفاً متغیر محیطی BOT_TOKEN را تنظیم کنید یا توکن را مستقیماً در کد قرار دهید (توصیه نمی‌شود برای محیط پروداکشن).");
  process.exit(1);
}

// یک شیء ربات ایجاد کنید
const bot = new Bot(botToken);

// افزایش حد مجاز listeners برای جلوگیری از هشدار MaxListenersExceeded
process.setMaxListeners(20);

// رویداد برای ذخیره پیام‌های جدید در پایگاه داده
bot.on("business_message", async (ctx) => {
  try {
    // بررسی وجود business_message
    if (!ctx.update.business_message) {
      console.warn("هشدار: business_message در آپدیت موجود نیست.");
      return;
    }
    
    const messageId = ctx.update.business_message.message_id;
    const chatId = ctx.chat ? ctx.chat.id.toString() : 'unknown';
    const userId = ctx.from ? ctx.from.id : 'unknown';
    const text = ctx.update.business_message.text || '';
    
    // ذخیره پیام در پایگاه داده
    await saveMessage(messageId, chatId, userId, text);
    console.log(`پیام ${messageId} در پایگاه داده ذخیره شد.`);
  } catch (error) {
    console.error("خطا در ذخیره پیام:", error);
  }
});

// رویداد برای پیام‌های ویرایش شده در چت‌های تجاری
bot.on("edited_business_message", async (ctx) => {
  try {
    // بررسی وجود edited_business_message
    if (!ctx.update.edited_business_message) {
      console.warn("هشدار: edited_business_message در آپدیت موجود نیست.");
      return;
    }
    
    const userId = ctx.from ? ctx.from.id : 'unknown';
    const messageId = ctx.update.edited_business_message.message_id;
    const chatId = ctx.chat ? ctx.chat.id.toString() : 'unknown';
    const newText = ctx.update.edited_business_message.text || '';
    const chatInfo = ctx.chat || { id: 'unknown' };

    // دریافت پیام اصلی از پایگاه داده قبل از به‌روزرسانی
    const originalMessage = await getMessage(messageId, chatId);
    
    let message = `✏️ editing noticed!\n\n`;
    
    if (originalMessage && originalMessage.text) {
      message += `old message by ${chatInfo.title || chatInfo.first_name || chatInfo.username || 'Dev'}:${originalMessage.text}\n`;
      message += `new message:${newText}`;
    } else {
      message += `new message by ${chatInfo.title || chatInfo.first_name || chatInfo.username || 'Dev'}:${newText}\n`;
      message += `⚠️ متن اصلی در پایگاه داده یافت نشد`;
    }

    // ابتدا پیام ویرایش شده را در پایگاه داده به‌روزرسانی کن
    try {
      await saveMessage(messageId, chatId, userId, newText);
      if (originalMessage && originalMessage.text) {
        console.log(`پیام ${messageId} در پایگاه داده به‌روزرسانی شد.`);
      } else {
        console.log(`پیام ویرایش شده ${messageId} برای اولین بار در پایگاه داده ذخیره شد.`);
      }
    } catch (error) {
      console.error("خطا در ذخیره/به‌روزرسانی پیام ویرایش شده در پایگاه داده:", error);
    }

    // سپس پیام را به ادمین ارسال کن
    const adminChatId = process.env.ADMIN_CHAT_ID || "YOUR_ADMIN_CHAT_ID";
    if (adminChatId === "YOUR_ADMIN_CHAT_ID"){
      console.warn("هشدار: ADMIN_CHAT_ID تنظیم نشده است. پیام ویرایش شده در کنسول چاپ می‌شود.");
      console.log("اطلاع رسانی ویرایش پیام به ادمین:\n" + message);
    } else {
      try {
        await bot.api.sendMessage(adminChatId, message);
        console.log("اطلاع رسانی ویرایش پیام به ادمین ارسال شد.");
      } catch (error) {
        console.error("خطا در ارسال پیام به ادمین:", error);
      }
    }
  } catch (error) {
    console.error("خطا در پردازش پیام ویرایش شده:", error);
  }
});

// رویداد برای پیام‌های حذف شده در چت‌های تجاری
// توجه: API تلگرام محتوای پیام حذف شده را ارائه نمی‌دهد.
// ما فقط می‌توانیم اطلاع دهیم که پیامی حذف شده است.
bot.on("deleted_business_messages", async (ctx) => {
  try {
    // بررسی وجود deleted_business_messages
    if (!ctx.update.deleted_business_messages) {
      console.warn("هشدار: deleted_business_messages در آپدیت موجود نیست.");
      return;
    }
    
    const userId = "ناشناس (API اطلاعات کاربر را برای پیام‌های حذف شده ارائه نمی‌دهد)"; // یا از ctx.chat.id اگر مربوط به چت خاصی است
    const chatInfo = ctx.chat || { id: 'unknown' };

  // Safely access the count of deleted messages
  let count = 0;
  if (ctx.update.deleted_business_messages && 
      ctx.update.deleted_business_messages.messages && 
      Array.isArray(ctx.update.deleted_business_messages.messages)) {
    count = ctx.update.deleted_business_messages.messages.length;
  } else {
    console.warn("هشدار: اطلاعات پیام‌های حذف شده (messages) در آپدیت موجود نیست یا فرمت نامعتبر دارد.");
    console.log("ساختار آپدیت:", JSON.stringify(ctx.update, null, 2));
    // در صورتی که تعداد دقیق مشخص نباشد، می‌توان یک پیام عمومی‌تر ارسال کرد
  }

  let message = `🗑 deletion noticed!\n\n`;
  message += `message by ${chatInfo.title || chatInfo.first_name || chatInfo.username || 'Dev'}:`;
  
  // اگر پیام‌های حذف شده موجود باشند، آخرین پیام را نمایش دهیم
  if (ctx.update.deleted_business_messages.messages && ctx.update.deleted_business_messages.messages.length > 0) {
    const lastDeletedMessage = ctx.update.deleted_business_messages.messages[ctx.update.deleted_business_messages.messages.length - 1];
    if (lastDeletedMessage.text) {
      message += lastDeletedMessage.text;
    } else {
      message += '[پیام بدون متن]';
    }
  } else {
    message += '[متن پیام در دسترس نیست]';
  }

  // به جای YOUR_ADMIN_CHAT_ID شناسه چت ادمین (خودتان) را قرار دهید
  const adminChatId = process.env.ADMIN_CHAT_ID || "YOUR_ADMIN_CHAT_ID";
  if (adminChatId === "YOUR_ADMIN_CHAT_ID"){
    console.warn("هشدار: ADMIN_CHAT_ID تنظیم نشده است. پیام حذف شده در کنسول چاپ می‌شود.");
    console.log("اطلاع رسانی حذف پیام به ادمین:\n" + message);
  } else {
    try {
      await bot.api.sendMessage(adminChatId, message);
      console.log("اطلاع رسانی حذف پیام به ادمین ارسال شد.");
    } catch (error) {
      console.error("خطا در ارسال پیام به ادمین:", error);
    }
  }
  } catch (error) {
    console.error("خطا در پردازش پیام‌های حذف شده:", error);
  }
});

// مدیریت خطاها
bot.catch((err) => {
  const ctx = err.ctx;
  console.error(`خطا هنگام پردازش آپدیت ${ctx.update.update_id}:`);
  const e = err.error;
  if (e instanceof Error) {
    console.error("خطا در listener یا middleware:", e);
  } else {
    console.error("خطای ناشناخته:", e);
  }
});

// ربات را شروع کنید (با استفاده از long polling)
async function startBot() {
  try {
    console.log("شروع ربات...");
    await bot.start();
    console.log("ربات با موفقیت شروع شد!");
  } catch (error) {
    console.error("خطا در شروع ربات:", error);
    process.exit(1);
  }
}

// Graceful shutdown
process.once('SIGINT', () => {
  console.log('\nدریافت سیگنال SIGINT. در حال توقف ربات...');
  bot.stop();
  process.exit(0);
});

process.once('SIGTERM', () => {
  console.log('\nدریافت سیگنال SIGTERM. در حال توقف ربات...');
  bot.stop();
  process.exit(0);
});

// شروع ربات فقط یک بار
if (!process.env.BOT_STARTED) {
  process.env.BOT_STARTED = 'true';
  startBot();
}

console.log("فایل bot.js بارگذاری شد. منتظر شروع ربات...");