async function test() {
  const update = {
    update_id: 123456789,
    message: {
      message_id: 1,
      date: Math.floor(Date.now() / 1000),
      chat: { id: 6824921456, type: "private" },
      from: { id: 6824921456, is_bot: false, first_name: "Admin", username: "admin" },
      text: "/start",
    },
  };

  try {
    const res = await fetch("https://azfur-sms.vercel.app/api/bot/webhook", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(update),
    });

    console.log("Status Code:", res.status);
    const text = await res.text();
    console.log("Response Body:", text);
  } catch (err) {
    console.error("Fetch error:", err);
  }
}

test();
