require('dotenv').config();
const { Bot } = require("grammy");

// توکن ربات خود را در اینجا قرار دهید
// اطمینان حاصل کنید که این توکن محرمانه باقی بماند و در کنترل نسخه به اشتراک گذاشته نشود.
const botToken = process.env.BOT_TOKEN || "YOUR_BOT_TOKEN";

if (botToken === "YOUR_BOT_TOKEN") {
  console.error("خطا: توکن ربات تنظیم نشده است. لطفاً متغیر محیطی BOT_TOKEN را تنظیم کنید یا توکن را مستقیماً در کد قرار دهید (توصیه نمی‌شود برای محیط پروداکشن).");
  process.exit(1);
}

// یک شیء ربات ایجاد کنید
const bot = new Bot(botToken);

// رویداد برای پیام‌های ویرایش شده در چت‌های تجاری
bot.on("edited_business_message", async (ctx) => {
  const userId = ctx.from.id;
  const oldText = ctx.editedBusinessMessage.text; // ممکن است undefined باشد اگر پیام قبلی متن نداشته باشد
  const newText = ctx.update.edited_business_message.text;
  const chatInfo = ctx.chat;

  let message = `کاربر با شناسه: ${userId}\n`;
  message += `در چت: ${chatInfo.title || chatInfo.first_name || chatInfo.username || chatInfo.id}\n`;
  if (oldText) {
    message += `پیام قبلی را ویرایش کرد:\n${oldText}\n`;
  }
  message += `پیام جدید:\n${newText}`;

  // به جای YOUR_ADMIN_CHAT_ID شناسه چت ادمین (خودتان) را قرار دهید
  // می‌توانید این شناسه را با ارسال پیام به ربات @userinfobot و دریافت اطلاعات خودتان پیدا کنید.
  const adminChatId = process.env.ADMIN_CHAT_ID || "YOUR_ADMIN_CHAT_ID";
  if (adminChatId === "YOUR_ADMIN_CHAT_ID"){
    console.warn("هشدار: ADMIN_CHAT_ID تنظیم نشده است. پیام ویرایش شده در کنسول چاپ می‌شود.");
    console.log("اطلاع رسانی ویرایش پیام به ادمین:\n" + message);
  } else {
    try {
      await bot.api.sendMessage(adminChatId, "پیام ویرایش شد:\n" + message);
      console.log("اطلاع رسانی ویرایش پیام به ادمین ارسال شد.");
    } catch (error) {
      console.error("خطا در ارسال پیام به ادمین:", error);
    }
  }
});

// رویداد برای پیام‌های حذف شده در چت‌های تجاری
// توجه: API تلگرام محتوای پیام حذف شده را ارائه نمی‌دهد.
// ما فقط می‌توانیم اطلاع دهیم که پیامی حذف شده است.
bot.on("deleted_business_messages", async (ctx) => {
  const userId = "ناشناس (API اطلاعات کاربر را برای پیام‌های حذف شده ارائه نمی‌دهد)"; // یا از ctx.chat.id اگر مربوط به چت خاصی است
  const chatInfo = ctx.chat;
  const count = ctx.update.deleted_business_messages.messages.length;

  let message = `کاربر در چت: ${chatInfo.title || chatInfo.first_name || chatInfo.username || chatInfo.id}\n`;
  message += `${count} پیام تجاری را حذف کرد.`;

  // به جای YOUR_ADMIN_CHAT_ID شناسه چت ادمین (خودتان) را قرار دهید
  const adminChatId = process.env.ADMIN_CHAT_ID || "YOUR_ADMIN_CHAT_ID";
   if (adminChatId === "YOUR_ADMIN_CHAT_ID"){
    console.warn("هشدار: ADMIN_CHAT_ID تنظیم نشده است. پیام حذف شده در کنسول چاپ می‌شود.");
    console.log("اطلاع رسانی حذف پیام به ادمین:\n" + message);
  } else {
    try {
      await bot.api.sendMessage(adminChatId, "پیام حذف شد:\n" + message);
      console.log("اطلاع رسانی حذف پیام به ادمین ارسال شد.");
    } catch (error) {
      console.error("خطا در ارسال پیام به ادمین:", error);
    }
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
  console.log("شروع ربات...");
  await bot.start();
  console.log("ربات با موفقیت شروع شد!");
}

startBot();

console.log("فایل bot.js بارگذاری شد. منتظر شروع ربات...");