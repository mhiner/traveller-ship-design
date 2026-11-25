const { NumberField, StringField, BooleanField, SchemaField, ObjectField, ArrayField } =
  foundry.data.fields;

/** A required number field. Module subtypes do not inherit the system's defaults. */
function number(initial) {
  return new NumberField({ required: true, initial, nullable: false });
}

/**
 * Repeats the Mongoose Traveller 0.25.0 spacecraft template.
 * A module subtype does not inherit the system's template.json.
 */
export class BlueprintShipModel extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      description: new StringField({ required: true, initial: "", blank: true }),
      // Actor id to quantity. The ship sheet reads these when placing carried hulls.
      docks: new ObjectField({ initial: {} }),
      moduleBay: new ObjectField({ initial: {} }),
      breakawayBay: new ObjectField({ initial: {} }),
      finance: new ObjectField({ initial: {} }),
      hits: new SchemaField({
        value: number(80),
        max: number(80),
        damage: number(0),
        criticals: new ObjectField({ initial: {} })
      }),
      initiative: new SchemaField({
        base: number(0),
        value: number(0)
      }),
      settings: new SchemaField({
        autoHits: new BooleanField({ initial: true }),
        enforceLimits: new BooleanField({ initial: true })
      }),
      crewed: new SchemaField({
        crew: new ObjectField({ initial: {} }),
        passengers: new ObjectField({ initial: {} }),
        roles: new ObjectField({ initial: {} }),
        selectedDepartment: new StringField({ initial: "all", blank: true })
      }),
      spacecraft: new SchemaField({
        dtons: number(100),
        type: new StringField({ initial: "", blank: true }),
        configuration: new StringField({ initial: "standard" }),
        isStandardDesign: new BooleanField({ initial: false }),
        hullOptions: new StringField({ initial: "", blank: true }),
        skill: new StringField({ initial: "pilot.spacecraft" }),
        tl: number(12),
        armour: number(0),
        cost: number(0),
        baseCost: number(0),
        radShielding: number(0),
        processing: number(0),
        deckplans: new ObjectField({ initial: {} }),
        computer: new SchemaField({
          processing: number(0),
          transponder: new StringField({ initial: "ACTIVE" }),
          bis: new BooleanField({ initial: false }),
          fib: new BooleanField({ initial: false })
        }),
        modifiers: new ObjectField({ initial: {} }),
        combat: new ObjectField({ initial: {} }),
        power: new SchemaField({
          value: number(0),
          max: number(10),
          used: number(0)
        }),
        fuel: new SchemaField({
          value: number(0),
          max: number(0)
        }),
        cargo: number(0),
        baySelected: new StringField({ initial: "cargo", blank: true }),
        mdrive: number(0),
        rdrive: number(0),
        jdrive: number(0),
        navy: new SchemaField({
          naval: new BooleanField({ initial: false }),
          supplies: new SchemaField({
            value: number(0),
            max: number(0)
          }),
          cei: new SchemaField({
            value: number(7),
            current: number(7)
          }),
          morale: number(7),
          divisions: new ObjectField({ initial: {} })
        })
      }),
      // The shipyard document. currentId selects the design the sheet projects.
      blueprint: new SchemaField({
        currentId: new StringField({ initial: "", blank: true }),
        designs: new ArrayField(new ObjectField({ initial: {} }), { initial: [] }),
        modules: new ArrayField(new ObjectField({ initial: {} }), { initial: [] })
      })
    };
  }
}
