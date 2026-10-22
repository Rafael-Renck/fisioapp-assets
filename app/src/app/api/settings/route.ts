import { randomUUID } from "node:crypto";
import { forbidden, noStore, settingsSpace } from "../../../lib/platform";
import { errorResponse, minutes, readDb, updateDb, type Location, type Service } from "../../../lib/store";
export const runtime = "nodejs";
export async function GET(request: Request) { const id = await settingsSpace(request); if (!id) return forbidden(); const { profile, locations, services, insurances, config } = await readDb(id); return noStore(Response.json({ profile, locations, services, insurances, config })); }
export async function PUT(request: Request) {
  const id = await settingsSpace(request); if (!id) return forbidden();
  try {
    const body = await request.json();
    const result = await updateDb(id, db => {
      if (body.action === "profile") {
        const displayName = String(body.displayName || "").trim(), registration = String(body.registration || "").trim(), phone = String(body.phone || "").trim(), email = String(body.email || "").trim();
        if (!displayName || displayName.length > 120 || registration.length > 80 || phone.length > 40 || email.length > 254) throw new Error("Dados do perfil inválidos.");
        db.profile = { displayName, registration, phone, email }; return db.profile;
      }
      if (body.action === "location") {
        const name = String(body.name || "").trim(), address = String(body.address || "").trim();
        if (!name || name.length > 120 || address.length > 240 || typeof body.active !== "boolean") throw new Error("Dados do local inválidos.");
        const existing = db.locations.find(item => item.id === body.id);
        if (body.id && !existing) throw new Error("Local não encontrado.");
        if (existing) { Object.assign(existing, { name, address, active: body.active }); return existing; }
        const item: Location = { id: randomUUID(), name, address, active: body.active }; db.locations.push(item); return item;
      }
      if (body.action === "service") {
        const name = String(body.name || "").trim(), duration = Number(body.duration);
        if (!name || name.length > 120 || !Number.isInteger(duration) || duration < 15 || duration > 480 || typeof body.active !== "boolean") throw new Error("Dados do atendimento inválidos.");
        const existing = db.services.find(item => item.id === body.id);
        if (body.id && !existing) throw new Error("Atendimento não encontrado.");
        if (existing) { Object.assign(existing, { name, duration, active: body.active }); return existing; }
        const item: Service = { id: randomUUID(), name, duration, active: body.active }; db.services.push(item); return item;
      }
      if (body.action === "insurance") {
        const name = String(body.name || "").trim();
        if (!name || name.length > 120) throw new Error("Nome do convênio inválido.");
        if (body.remove) db.insurances = db.insurances.filter(item => item !== name);
        else if (!db.insurances.some(item => item.toLowerCase() === name.toLowerCase())) db.insurances.push(name);
        return db.insurances;
      }
      if (body.action === "schedule") {
        const days = body.days, duration = Number(body.duration), capacity = Number(body.capacity);
        if (!Array.isArray(days) || days.length !== 7 || !days.every(day => day && typeof day.active === "boolean" && minutes(day.start) >= 0 && minutes(day.end) > minutes(day.start)) || !Number.isInteger(duration) || duration < 15 || duration > 480 || !Number.isInteger(capacity) || capacity < 1 || capacity > 100) throw new Error("Expediente inválido.");
        db.config = { days: days.map(day => ({ active: day.active, start: day.start, end: day.end })), duration, capacity }; return db.config;
      }
      throw new Error("Ação desconhecida.");
    });
    return noStore(Response.json(result));
  } catch (error) { return errorResponse(error); }
}
