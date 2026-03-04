

HOST="$DB_HOST"
PORT="$DB_PORT"
MAX_RETRIES=30
RETRY_INTERVAL=3

echo "Esperando a que MySQL ($HOST:$PORT) esté listo..."

RETRIES=0 
while [ $RETRIES -lt $MAX_RETRIES ]; do
  # Intentar conectar con Node.js (usa el mismo driver que la app)
  node -e "


    import('mysql2/promise').then(async (mysql) => {
      try {
        const conn = await mysql.createConnection({
          host: '$HOST',
          port: $PORT, 
          user: '$DB_USER',
          password: '$DB_PASSWORD',
          database: '$DB_NAME',
          connectTimeout: 5000
        });
        await conn.query('SELECT 1');
        await conn.end();
        process.exit(0);
      } catch(e) {
        process.exit(1);
      }
    });
  " 2>/dev/null

  if [ $? -eq 0 ]; then
    echo "MySQL está listo!"
    exec "$@"
    exit 0
  fi

  RETRIES=$((RETRIES + 1))
  echo "   Intento $RETRIES/$MAX_RETRIES - MySQL no está listo, reintentando en ${RETRY_INTERVAL}s..."
  sleep $RETRY_INTERVAL
done

echo " MySQL no respondió después de $MAX_RETRIES intentos"
exit 1
