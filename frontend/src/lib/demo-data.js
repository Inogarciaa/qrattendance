import { formatTime } from "./format";

// Demo data for the UI prototype. Remove this file's usage as each page is
// connected to the Express API.
const now = new Date();
export const TODAY = now.toISOString().slice(0, 10);

export const EVENTS = [
  {
    id: 1,
    name: "Seminar",
    date: TODAY,
    start: "08:00",
    end: "23:59",
    venue: "LCC Auditorium",
    mode: "Gatekeeper Scan Mode",
  },
  {
    id: 2,
    name: "Orientation",
    date: "2026-09-18",
    start: "09:00",
    end: "12:00",
    venue: "Room 301",
    mode: "Self-Service Scan Mode",
  },
  {
    id: 3,
    name: "Mass",
    date: "2026-09-05",
    start: "13:00",
    end: "15:00",
    venue: "Chapel",
    mode: "Gatekeeper Scan Mode",
  },
];

export const isLive = (event) => {
  if (event.date !== TODAY) return false;
  const current = now.getHours() * 60 + now.getMinutes();
  const [startHour, startMinute] = event.start.split(":").map(Number);
  const [endHour, endMinute] = event.end.split(":").map(Number);
  return current >= startHour * 60 + startMinute && current <= endHour * 60 + endMinute;
};

export const STUDENTS = [
  ["2023-0142", "Maria Santos", "BSIT"],
  ["2023-0157", "Jose Ramirez", "BSIT"],
  ["2024-0210", "Angela Cruz", "BSBA"],
  ["2024-0233", "Paolo Mendoza", "BSIT"],
  ["2023-0318", "Kristine Lopez", "BSED"],
  ["2024-0345", "Rafael Dizon", "BSIT"],
  ["2023-0402", "Bea Villanueva", "BSBA"],
  ["2024-0419", "Carlo Yap", "BSED"],
].map(([id, name, program]) => ({ id, name, program }));

const SEQUENCE = ["Present", "Present", "Late", "Present", "Absent", "Late", "Present", "Absent"];

export const ATTENDANCE = EVENTS.flatMap((event, eventIndex) =>
  STUDENTS.map((student, studentIndex) => {
    const status = SEQUENCE[(studentIndex + eventIndex * 3) % 8];
    return {
      event,
      student,
      status,
      time:
        status === "Absent"
          ? "—"
          : formatTime(
              event.start.split(":")[0] * 60 +
                studentIndex * 3 +
                (status === "Late" ? 20 : 0)
            ),
    };
  })
);

export const PROGRAMS = ["BSIT", "BSBA", "BSED"];
export const STATUSES = ["Present", "Late", "Absent"];

export const SCAN_MODES = [
  [
    "Gatekeeper Scan Mode",
    "uc",
    "Organizers scan each student's QR and verify their photo before saving.",
  ],
  [
    "Self-Service Scan Mode",
    "mon",
    "Students scan the event QR shown on a projector or TV. Best for large venues.",
  ],
  ["Dual Mode", "lay", "Use both methods at the same time."],
];
