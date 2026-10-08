async function test() {
  const update = {
    update_id: 123456789,
    message: {
      message_id: 1,
      date: Math.floor(Date.now() / 1000),
      chat: { id: 7619776444, type: "private" },
      from: { id: 7619776444, is_bot: false, first_name: "Aziz", username: "azizifiliz" },
      text: "/admin",
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
