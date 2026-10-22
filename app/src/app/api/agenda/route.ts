import { active, addDays, checkSession, dayOf, errorResponse, minutes, readDb, requireObject, statuses, updateDb, validDate, type Block, type Config, type Session, type Status } from "../../../lib/store";
import { forbidden, physioSpace } from "../../../lib/platform";

export const runtime = "nodejs";
export async function GET(request: Request) { const spaceId = await physioSpace(request); if (!spaceId) return forbidden(); const { sessions, blocks, config, locations, services } = await readDb(spaceId); return Response.json({ sessions, blocks, config, locations, services }, { headers: { "Cache-Control": "no-store" } }); }
export async function POST(request: Request) {
  const spaceId = await physioSpace(request); if (!spaceId) return forbidden();
  try {
    const body = requireObject(await request.json());
    const result = await updateDb(spaceId, db => {
      switch (body.action) {
        case "book": {
          const patientId = String(body.patientId || ""), date = String(body.date || ""), time = String(body.time || ""), notes = String(body.notes || "").trim();
          const locationId = String(body.locationId || ""), serviceId = String(body.serviceId || "");
          if (notes.length > 2000) throw new Error("Observações muito longas.");
          if (db.locations.some(location => location.active) && !locationId) throw new Error("Selecione um local de atendimento.");
          if (db.services.some(service => service.active) && !serviceId) throw new Error("Selecione um tipo de atendimento.");
          const service = db.services.find(item => item.id === serviceId && item.active);
          if (serviceId && !service) throw new Error("Tipo de atendimento inválido.");
          if (!validDate(date) || minutes(time) < 0) throw new Error("Data ou horário inválido.");
          const weekdays = body.weekdays;
          const count = body.count === undefined ? 1 : Number(body.count);
          if (!Number.isInteger(count) || count < 1 || count > 260) throw new Error("Quantidade de sessões inválida (1 a 260).");
          if (!Array.isArray(weekdays) || !weekdays.every(d => Number.isInteger(d) && d >= 0 && d <= 6) || (count > 1 && weekdays.length === 0)) throw new Error("Selecione dias da semana válidos.");
          const days = [...new Set(weekdays as number[])];
          if (count > 1 && !days.includes(dayOf(date))) throw new Error("A data inicial deve ser um dos dias selecionados.");
          const recurrenceId = count > 1 ? crypto.randomUUID() : undefined;
          const proposed: Session[] = [];
          for (let offset = 0; proposed.length < count && offset < 7 * 260; offset++) {
            const currentDate = addDays(date, offset);
            if (count > 1 && !days.includes(dayOf(currentDate))) continue;
            const session: Session = { id: crypto.randomUUID(), patientId, date: currentDate, time, duration: service?.duration || db.config.duration, notes, status: "Agendado", recurrenceId, locationId, serviceId };
            const conflict = checkSession({ ...db, sessions: [...db.sessions, ...proposed] }, session);
            if (conflict) throw new Error(`${currentDate}: ${conflict} Nenhuma sessão foi criada.`);
            proposed.push(session);
          }
          db.sessions.push(...proposed);
          return proposed;
        }
        case "status": {
          const session = db.sessions.find(s => s.id === body.id);
          if (!session || !statuses.includes(body.status as Status)) throw new Error("Sessão ou status inválido.");
          if (!active(session) && !String(body.status).startsWith("Cancelado") && body.status !== "Não Compareceu") {
            const conflict = checkSession(db, session, session.id); if (conflict) throw new Error(conflict);
          }
          session.status = body.status as Status; return session;
        }
        case "reschedule": {
          const session = db.sessions.find(s => s.id === body.id);
          if (!session) throw new Error("Sessão não encontrada.");
          const next = { ...session, date: String(body.date || ""), time: String(body.time || "") };
          const conflict = checkSession(db, next, session.id);
          if (conflict) throw new Error(conflict);
          session.date = next.date; session.time = next.time; return session;
        }
        case "block": {
          const date = String(body.date || ""), start = String(body.start || ""), end = String(body.end || ""), reason = String(body.reason || "").trim();
          if (!validDate(date) || minutes(start) < 0 || minutes(end) <= minutes(start) || !reason || reason.length > 300) throw new Error("Período ou motivo inválido.");
          if (db.sessions.some(s => active(s) && s.date === date && minutes(start) < minutes(s.time) + s.duration && minutes(end) > minutes(s.time))) throw new Error("Há sessões ativas nesse período.");
          const block: Block = { id: crypto.randomUUID(), date, start, end, reason }; db.blocks.push(block); return block;
        }
        case "unblock": {
          const index = db.blocks.findIndex(b => b.id === body.id); if (index < 0) throw new Error("Bloqueio não encontrado.");
          return db.blocks.splice(index, 1)[0];
        }
        case "config": {
          const input = requireObject(body.config);
          if (!Array.isArray(input.days) || input.days.length !== 7 || !input.days.every(d => d && typeof d.active === "boolean" && minutes(d.start) >= 0 && minutes(d.end) > minutes(d.start))) throw new Error("Expediente inválido.");
          const duration = Number(input.duration), capacity = Number(input.capacity);
          if (!Number.isInteger(duration) || duration < 15 || duration > 480 || !Number.isInteger(capacity) || capacity < 1 || capacity > 100) throw new Error("Duração ou capacidade inválida.");
          db.config = { days: input.days, duration, capacity } as Config; return db.config;
        }
        default: throw new Error("Ação desconhecida.");
      }
    });
    return Response.json(result);
  } catch (error) { return errorResponse(error); }
}
