import { z } from "zod";
import { convertPressure, flowRegime, ISS_PO2_PSI, o2VsEarth, pO2Calc, ratioToISS, type PressureUnit } from "@/lib/physics";
import { resolveConditions } from "./resolve";
import { defineTool, fail, FORMULA_SOURCE } from "./types";

const Unit = z.enum(["psi", "bar", "atm", "kPa"]);

export const physicsCalc = defineTool({
  name: "physics_calc",
  description:
    "Tested formulas: O2 partial pressure (pO2), ratio to ISS pO2 (3.087 psi), O2 versus Earth air (21%), airflow regime (still < 5, low < 20, forced >= 20 cm/s) and pressure unit conversion. Give o2_pct + pressure_psi (or a mission id) and/or flow_cm_s and/or a conversion. Every result includes its formula.",
  input: z.object({
    o2_pct: z.number().min(0).max(100).optional(),
    pressure_psi: z.number().positive().optional(),
    mission: z.string().optional().describe("Mission id: iss, lunar-base, lunar-rover, spacesuit"),
    flow_cm_s: z.number().optional(),
    convert_value: z.number().optional().describe("Pressure value to convert"),
    convert_from: Unit.optional(),
    convert_to: Unit.optional(),
  }),
  run(input, ctx) {
    const out: Record<string, unknown> = {};
    const c = resolveConditions(input, ctx);
    if (c) {
      out.inputs = c;
      out.po2 = pO2Calc(c.o2_pct, c.pressure_psi);
      out.ratio_to_iss = ratioToISS(c.o2_pct, c.pressure_psi);
      out.o2_vs_earth = o2VsEarth(c.o2_pct);
      out.iss_po2_psi = ISS_PO2_PSI;
    }
    if (input.flow_cm_s != null) out.flow_regime = { flow_cm_s: input.flow_cm_s, ...flowRegime(input.flow_cm_s) };
    if (input.convert_value != null && input.convert_from && input.convert_to) {
      out.conversion = convertPressure(input.convert_value, input.convert_from as PressureUnit, input.convert_to as PressureUnit);
    }
    if (!Object.keys(out).length) return fail("physics_calc needs o2_pct + pressure_psi, a mission, flow_cm_s or a conversion");
    const po2 = out.po2 as { value: number } | undefined;
    return {
      ok: true,
      data: out,
      sources: [FORMULA_SOURCE],
      confidence: "supported",
      summary: po2 ? `pO2 = ${po2.value} psi` : "calculation done",
    };
  },
});
