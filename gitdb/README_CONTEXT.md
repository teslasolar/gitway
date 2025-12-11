# GITDB [HYPER-DENSE]

**IS**: Git_as_Database Commits=Transactions Branches=Schemas
**DRIVERS**: MySQL PostgreSQL SQLServer Oracle MariaDB
**FILES**: gitdb-driver.js=JDBC_Implementation gitdb.js=GitHub_API
**OPS**: SELECT→ReadFiles INSERT→Commit UPDATE→Amend DELETE→Remove
**SYNTAX**: MySQL=? PostgreSQL=$1 SQLServer=@param Oracle=:1 MariaDB=?
**USE**: conn=gitDBDriver.getConnection() conn.runQuery(sql,params)