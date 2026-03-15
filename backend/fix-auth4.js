const fs = require('fs');
let content = fs.readFileSync('tests/services/authService.test.js', 'utf8');

content = content.replace(
    /expect\(db\.user\.updateMany\)\.toHaveBeenCalledWith\(\{\s*where: \{\s*id: user\.id\s*\},\s*data: \{\s*password: 'newHashedPassword',\s*passwordChangedAt: expect\.any\(Date\)\s*\}\s*\}\);/g,
    `expect(db.user.updateMany).toHaveBeenCalledWith({
        where: { id: user.id, branchId: { not: null } },
        data: { password: 'newHashedPassword', passwordChangedAt: expect.any(Date) }
      });`
);

content = content.replace(
    /expect\(db\.user\.updateMany\)\.toHaveBeenCalledWith\(\{\s*where: \{\s*id: user\.id\s*\},\s*data: \{\s*password: 'newHashedPassword',\s*passwordChangedAt: expect\.any\(Date\),\s*mustChangePassword: false\s*\}\s*\}\);/g,
    `expect(db.user.updateMany).toHaveBeenCalledWith({
        where: { id: user.id, branchId: { not: null } },
        data: {
          password: 'newHashedPassword',
          passwordChangedAt: expect.any(Date),
          mustChangePassword: false
        }
      });`
);

fs.writeFileSync('tests/services/authService.test.js', content);
