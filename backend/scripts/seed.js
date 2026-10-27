require("dotenv").config();
const { admin } = require("../src/lib/supabase");
const { toEmail, buildPassword, toBirthdate } = require("../src/lib/password");

const PROGRAMS = [
  { code: "BSIT", name: "BS Information Technology" },
  { code: "BSBA", name: "BS Business Administration" },
  { code: "BSED", name: "BS Education" },
];

const PEOPLE = [
  { school_id: "ADMIN-0001", full_name: "Ino Garcia", birthdate: "1985-01-15", role: "admin", program_code: null, year_level: null },
  { school_id: "2023-0142", full_name: "Maria Santos", birthdate: "2003-04-12", role: "student", program_code: "BSIT", year_level: 3 },
  { school_id: "2023-0157", full_name: "Jose Ramirez", birthdate: "2003-08-02", role: "student", program_code: "BSIT", year_level: 3 },
  { school_id: "2024-0210", full_name: "Angela Cruz", birthdate: "2004-01-20", role: "student", program_code: "BSBA", year_level: 2 },
  { school_id: "2024-0233", full_name: "Paolo Mendoza", birthdate: "2004-03-09", role: "student", program_code: "BSIT", year_level: 2 },
  { school_id: "2023-0318", full_name: "Kristine Lopez", birthdate: "2003-11-25", role: "student", program_code: "BSED", year_level: 3 },
  { school_id: "2024-0345", full_name: "Rafael Dizon", birthdate: "2004-06-30", role: "organizer", program_code: "BSIT", year_level: 2 },
  { school_id: "2023-0402", full_name: "Bea Villanueva", birthdate: "2003-02-14", role: "organizer", program_code: "BSBA", year_level: 3 },
];

async function findExisting(email) {
  const { data, error } = await admin.auth.admin.listUsers({ perPage: 1000 });
  if (error) throw error;
  return data.users.find((user) => user.email === email);
}

async function ensureUser(person, programByCode) {
  const email = toEmail(person.school_id);
  const password = buildPassword(person.school_id, person.birthdate);

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { school_id: person.school_id, full_name: person.full_name, role: person.role },
  });

  let userId;
  if (error) {
    const existing = await findExisting(email);
    if (!existing) throw error;
    userId = existing.id;
    await admin.auth.admin.updateUserById(userId, { password });
  } else {
    userId = data.user.id;
  }

  const { error: profileError } = await admin.from("profiles").upsert(
    {
      id: userId,
      school_id: person.school_id,
      full_name: person.full_name,
      role: person.role,
      program_id: person.program_code ? programByCode[person.program_code] : null,
      year_level: person.year_level,
      birthdate: toBirthdate(person.birthdate),
      is_active: true,
    },
    { onConflict: "id" }
  );
  if (profileError) throw profileError;

  return { userId, email, password };
}

async function main() {
  for (const program of PROGRAMS) {
    await admin.from("programs").upsert(program, { onConflict: "code" });
  }

  const { data: programs, error } = await admin.from("programs").select("id, code");
  if (error) throw error;
  const programByCode = {};
  for (const p of programs) programByCode[p.code] = p.id;

  const accounts = [];
  for (const person of PEOPLE) {
    const result = await ensureUser(person, programByCode);
    accounts.push({ ...result, role: person.role, full_name: person.full_name });
  }

  const adminAccount = accounts.find((a) => a.role === "admin");
  const organizer = accounts.find((a) => a.role === "organizer");
  const today = new Date().toISOString().slice(0, 10);

  const { data: existingEvent } = await admin.from("events").select("id").eq("name", "Sample Seminar").maybeSingle();
  if (!existingEvent) {
    const { data: event, error: eventError } = await admin
      .from("events")
      .insert({
        name: "Sample Seminar",
        description: "Seeded event for testing",
        venue: "LCC Auditorium",
        event_date: today,
        start_time: "08:00",
        end_time: "17:00",
        grace_minutes: 15,
        scan_mode: "dual",
        status: "live",
        created_by: adminAccount.userId,
      })
      .select()
      .single();
    if (eventError) throw eventError;

    await admin.from("event_organizers").insert({ event_id: event.id, profile_id: organizer.userId });
    await admin.from("event_audiences").insert([
      { event_id: event.id, program_id: programByCode.BSIT },
      { event_id: event.id, program_id: programByCode.BSBA },
      { event_id: event.id, program_id: programByCode.BSED },
    ]);
  }

  console.log("\nSeeded accounts (password = digits(school_id) + YYYYMMDD(birthdate)):");
  for (const account of accounts) {
    console.log(`  ${account.role.padEnd(9)} ${account.email.padEnd(28)} password: ${account.password}`);
  }
  console.log("\nDone.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
