import { createAdmin, deleteAdmin, getAdmin, updateAdmin } from './admin'
import { createPublisher, deletePublisher, getPublisher, updatePublisher } from './publisher'
import { createSite, deleteSite, getSite, updateSite } from './sites'

export default {
  admin: {
    create: createAdmin,
    update: updateAdmin,
    get: getAdmin,
    delete: deleteAdmin
  },
  publisher: {
    create: createPublisher,
    update: updatePublisher,
    get: getPublisher,
    delete: deletePublisher
  },
  sites: {
    create: createSite,
    update: updateSite,
    get: getSite,
    delete: deleteSite
  }
}
