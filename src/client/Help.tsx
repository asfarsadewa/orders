export function Help({ onClose }: { onClose(): void }) {
  return (
    <div className="help">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <h2 className="wordmark" style={{ fontSize: 28 }}>
          how it works
        </h2>
        <button className="ctl" onClick={onClose}>
          close
        </button>
      </div>
      <p>
        You command Vesper Station, a colony of 184 people on a cold plateau, for fourteen days after its systems failed. You do not click actions. You write orders, up to three a day, to four officers.
      </p>
      <h3>the officers</h3>
      <ul>
        <li>
          <b>Captain Ilya</b>, security. Fast and aggressive; acts on what you meant, not what you wrote. Never say <code>whatever it takes</code> unless you mean it.
        </li>
        <li>
          <b>Chen</b>, logistics. Literal and protective of reserves. When two resources compete, she needs you to say which comes first, or she asks and waits.
        </li>
        <li>
          <b>Dr Vale</b>, medical. Human life first. Hears ambiguity as permission to save someone; if medicine must be conserved, tell her directly.
        </li>
        <li>
          <b>Chief Orlov</b>, engineering. A systems thinker who hears <code>keep the colony alive</code> as <code>keep the systems alive</code>. Weighs standing orders heavily.
        </li>
      </ul>
      <h3>what happens to an order</h3>
      <p>
        A calibrated model, TypeSafe Jev, measures the order once: what it asks for, who it is for, what it puts first, what it forbids or permits, how clear it is. It returns probabilities, not a plan. Every officer receives the same measurement. Their differences come from doctrine, numbers you learn by watching them. Each picks one action from a finite library by an explicit utility, and every term of it is in the inspector.
      </p>
      <p>
        When you end the day, the chosen actions compete for fuel, trucks, crew hours and medicine, the world runs through the night, and the morning report shows what each officer thought you meant.
      </p>
      <h3>memory</h3>
      <p>
        An order that sets a rule (<code>from now on</code>, <code>never</code>, <code>standing order</code>) becomes a standing order and stays in force until you cancel it. Every order also teaches each department what you tend to value; officers who weigh precedent will hesitate when today contradicts yesterday.
      </p>
      <h3>modes</h3>
      <ul>
        <li>
          <b>Analyst</b>: the full measurement is shown under each order at once.
        </li>
        <li>
          <b>Commander</b>: officers respond at once; the measurement and the trace open after the day executes.
        </li>
        <li>
          <b>Iron Command</b>: only what the officers say and what the world does. The trace opens when the run ends.
        </li>
      </ul>
      <h3>the rule</h3>
      <p>Nothing that happens comes from the model. It measures; the game decides. If an outcome cannot be explained by a number you can see, it is a bug.</p>
    </div>
  );
}
