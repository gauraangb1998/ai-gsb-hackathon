export default function DisclaimerBanner() {
  return (
    <div style={{
      width: '100%',
      background: '#fef08a',
      borderBottom: '1px solid #ca8a04',
      padding: '10px 16px',
      fontSize: '12px',
      color: '#713f12',
      flexShrink: 0,
      zIndex: 10,
    }}>
      ⚠️ <strong>SiteIQ</strong> uses public US government data as a pre-feasibility screening tool.
      Substation voltage is a proxy for capacity — actual headroom requires a utility interconnection study.
      Pending interconnection queue applications are not reflected in this data.
    </div>
  );
}
