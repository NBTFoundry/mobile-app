// SPDX-License-Identifier: MPL-2.0
import { PERM, permissionLabels, permissionsOf } from '../src/protocol/permissions';

describe('permissions', () => {
  it('derives what a package may do from its bridge lines', () => {
    expect(permissionsOf(['bridge=1.9', 'bridge-uses=show', 'bridge-optional=service,car-data,files,net,diag,most',
      'bridge-most=rx:*.*.*,tx:05.00.621', 'bridge-diag=12:read+codes+clear,29:read+control+drive']))
      .toBe(PERM.background | PERM.carData | PERM.files | PERM.phoneNet | PERM.engine | PERM.clear
        | PERM.control | PERM.drive | PERM.mostRead | PERM.mostSend);
    expect(permissionsOf(['bridge-optional=most', 'bridge-most=tx:*.*.*'])).toBe(PERM.mostSend | PERM.mostAny);
    expect(permissionsOf(['bridge-optional=most', 'bridge-most=tx:05.00.001'])).toBe(PERM.mostSend | PERM.mostAny);
    expect(permissionsOf(['bridge=1.5', 'bridge-uses=show,status'])).toBe(0);
    expect(permissionsOf([])).toBe(0);
  });

  it('ignores policies of capabilities not declared, and malformed lists', () => {
    expect(permissionsOf(['bridge-optional=car-data', 'bridge-diag=12:clear'])).toBe(PERM.carData);
    expect(permissionsOf(['bridge-optional=Diag,most', 'bridge-most=tx:*.*.*'])).toBe(0);
  });

  it('lists what it uses, then what it can do, and when', () => {
    expect(permissionLabels(PERM.carData | PERM.engine | PERM.control | PERM.mostSend | PERM.mostAny))
      .toEqual({ uses: ['perm.carData', 'perm.engine'], can: ['perm.control', 'perm.mostAny'], driving: false });
    expect(permissionLabels(PERM.clear | PERM.drive).driving).toBe(true);
    expect(permissionLabels(PERM.mostSend)).toEqual({ uses: [], can: ['perm.mostSend'], driving: undefined });
  });
});
