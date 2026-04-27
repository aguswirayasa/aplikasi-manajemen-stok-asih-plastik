async function testNextAuth() {
  const formData = new URLSearchParams();
  formData.append("username", "admin");
  formData.append("password", "admin");

  const csrfRes = await fetch("http://localhost:3000/api/auth/csrf");
  const csrfJson = await csrfRes.json();
  formData.append("csrfToken", csrfJson.csrfToken);

  const res = await fetch("http://localhost:3000/api/auth/callback/credentials", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Cookie: csrfRes.headers.get("set-cookie") || "",
    },
    body: formData.toString(),
  });

  const text = await res.text();
  console.log("Status:", res.status);
  console.log("Redirect:", res.url);

  if (text.includes("Invalid password")) {
    console.log("Failed: Invalid password found in response");
  } else {
    console.log("Success? Response snippet:", text.substring(0, 200));
  }
}

testNextAuth().catch(console.error);
