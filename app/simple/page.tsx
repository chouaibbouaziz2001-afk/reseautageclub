export default function SimplePage() {
  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(to bottom right, #0a0a0a, #1a1a1a)',
      color: 'white',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'column',
      padding: '20px'
    }}>
      <div style={{
        fontSize: '48px',
        marginBottom: '20px'
      }}>
        ✅
      </div>

      <h1 style={{
        fontSize: '36px',
        fontWeight: 'bold',
        color: '#10b981',
        marginBottom: '20px'
      }}>
        Application is Working!
      </h1>

      <div style={{
        background: '#1f2937',
        padding: '30px',
        borderRadius: '10px',
        maxWidth: '600px',
        width: '100%'
      }}>
        <h2 style={{ color: '#f59e0b', marginBottom: '15px' }}>System Status</h2>

        <div style={{ marginBottom: '10px' }}>
          <strong>Next.js:</strong> Running ✅
        </div>

        <div style={{ marginBottom: '10px' }}>
          <strong>React:</strong> Rendering ✅
        </div>

        <div style={{ marginBottom: '10px' }}>
          <strong>Build:</strong> Successful ✅
        </div>

        <div style={{ marginBottom: '10px' }}>
          <strong>Timestamp:</strong> {new Date().toLocaleString()}
        </div>
      </div>

      <div style={{ marginTop: '30px', display: 'flex', gap: '15px' }}>
        <a
          href="/"
          style={{
            background: '#f59e0b',
            color: '#0a0a0a',
            padding: '12px 24px',
            borderRadius: '8px',
            textDecoration: 'none',
            fontWeight: 'bold'
          }}
        >
          Go to Home
        </a>

        <a
          href="/test"
          style={{
            background: '#374151',
            color: 'white',
            padding: '12px 24px',
            borderRadius: '8px',
            textDecoration: 'none',
            fontWeight: 'bold'
          }}
        >
          Go to Test Page
        </a>
      </div>

      <p style={{
        marginTop: '30px',
        color: '#9ca3af',
        fontSize: '14px',
        textAlign: 'center'
      }}>
        This is a simple page with NO providers, NO auth, NO context.
        <br />
        If you see this, Next.js is working perfectly.
      </p>
    </div>
  );
}
