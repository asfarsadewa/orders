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
      <p>You command Vesper Station, a colony of 184 people, for 14 days after a systems failure. There are no action buttons. You write orders in plain text to four officers. You can write up to three orders each day.</p>
      <h3>the officers</h3>
      <ul>
        <li>
          <b>Captain Ilya</b>, security. High initiative, low literalness, low risk aversion. He acts on the intent of an order. He does not act on the exact words. If you do not accept casualties, do not write <code>whatever it takes</code> or <code>at any cost</code>.
        </li>
        <li>
          <b>Chen</b>, logistics. High literalness, high resource caution. If an order needs two resources and does not rank them, she asks a question and waits for the answer. State which resource comes first.
        </li>
        <li>
          <b>Dr Vale</b>, medical. High life priority. If an order is not specific, she selects the action that saves the most lives. If you want her to conserve medicine, say so in the order.
        </li>
        <li>
          <b>Chief Orlov</b>, engineering. High infrastructure weight, high precedent weight. He protects the generator, the pumps and the pipes before comfort. He follows standing orders closely. If a new order conflicts with a standing order, he says so before he acts.
        </li>
      </ul>
      <h3>what happens to an order</h3>
      <ol>
        <li>The model, TypeSafe Jev, measures the order one time. It answers about 55 typed questions: the objective, the owner, the sector, the priorities, the constraints and the clarity.</li>
        <li>The model returns probabilities. It does not return a plan.</li>
        <li>Each officer in the order's scope receives the same measurement.</li>
        <li>Each officer scores every action in their library with a fixed formula. The formula uses the measurement and the officer's doctrine.</li>
        <li>The officer selects the action with the highest score. If the order is not clear enough, the officer asks a question instead.</li>
        <li>When you end the day, the selected actions share the fuel, the trucks, the crew hours and the medicine.</li>
        <li>The game simulates the night. The morning report shows each action and its effects.</li>
        <li>The inspector shows every number in the formula.</li>
      </ol>
      <h3>memory</h3>
      <p>
        An order that sets a rule becomes a standing order. Examples: <code>from now on</code>, <code>never</code>, <code>standing order</code>. A standing order stays in force until you cancel it. Each order also records the priorities you stated. The record decays over the following days. An officer with high precedent weight checks each new order against the standing orders and the record. If there is a conflict, the officer asks a question.
      </p>
      <h3>modes</h3>
      <ul>
        <li>
          <b>Analyst</b>: The full measurement shows under each order when you send it.
        </li>
        <li>
          <b>Commander</b>: The officers answer when you send an order. The measurement and the trace open after you end the day.
        </li>
        <li>
          <b>Iron Command</b>: You see only the officers' words and the results. The trace opens when the run ends.
        </li>
      </ul>
      <h3>what the model does</h3>
      <p>The model only measures the order. The game code selects every action. The game code calculates every result. Every number in a result is visible in the inspector. If you find a result with no visible number behind it, report it as a bug.</p>
    </div>
  );
}
