export function demoCustomers() {
  const people = [
    "Alex Morgan",
    "Jordan Lee",
    "Taylor Davis",
    "Casey Parker",
    "Sam Rivera",
    "Morgan Chen",
    "Jamie Brooks",
    "Drew Campbell",
    "Avery Wilson",
    "Riley Bennett",
    "Quinn Hayes",
    "Reese Patel",
    "Cameron Ellis",
    "Blake Simmons",
    "Peyton Ross",
    "Skyler James",
    "Harper Scott",
    "Dakota Reed",
  ];
  return people.map((name, i) => ({
    _id: `customer-demo-${i}`,
    name,
    email: i === 7 ? "" : `${name.split(" ")[0].toLowerCase()}@example.com`,
    phone: `(860) 555-${String(101 + i).padStart(4, "0")}`,
    vehicles: [
      [
        "2022 Toyota Camry",
        "2024 Honda CR-V",
        "2019 Ford F-150",
        "2022 Toyota RAV4",
      ][i % 4],
    ],
    stores: [i % 3 === 1 ? "hartford" : "wethersfield"],
    services: [
      [
        "car-audio",
        "auto-detailing",
        "electrical-installation",
        "remote-starters",
      ][i % 4],
    ],
    sources: i % 3 === 0 ? ["estimate"] : ["appointment", "estimate"],
    firstSeen: Date.now() - (i + 30) * 86400000,
    lastSeen: Date.now() - i * 86400000,
    marketingStatus:
      i === 2 ? "unsubscribed" : i === 4 ? "unknown" : "subscribed",
    conflicts: i === 5 ? ["Phone differs between requests"] : [],
    blocked: i === 8,
    consent:
      i === 4
        ? undefined
        : {
            at: Date.now() - 30 * 86400000,
            source: "Demo form",
            text: "Fictional permission for local preview.",
            version: "demo",
          },
  }));
}
