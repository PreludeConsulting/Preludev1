export default function BillingInvoicesTable({ invoices }) {
  return (
    <div className="billing-invoices">
      <div className="billing-invoices__table-wrap">
        <table className="billing-invoices__table">
          <thead>
            <tr>
              <th scope="col">Invoice #</th>
              <th scope="col">Date</th>
              <th scope="col">Description</th>
              <th scope="col">Amount</th>
              <th scope="col">Status</th>
            </tr>
          </thead>
          <tbody>
            {invoices.map((invoice) => (
              <tr key={invoice.id}>
                <td className="billing-invoices__id">{invoice.id}</td>
                <td>{invoice.date}</td>
                <td>{invoice.description}</td>
                <td className="billing-invoices__amount">{invoice.amount}</td>
                <td>
                  <span className="billing-invoices__status">{invoice.status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
