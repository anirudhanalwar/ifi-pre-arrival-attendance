const config = {
    user: 'Nitesh',
    password: '123',
    server: 'localhost',
    database: 'nitesh',
    options: {
        trustServerCertificate: true,
        trustedConnection: false,
        enableArithAbort: true,
        instancename: 'MSSQLSERVER02'
    },
    port: 1433
}

module.exports = config;
