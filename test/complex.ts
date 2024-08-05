import { ObjectId } from 'mongodb';
import { ModelUpdateDocument } from '../src/types/external';

// Example MongoDB document type
type DocumentDoc = {
    _id: ObjectId;
  property: {
    subproperty: {
      subsubproperty: string;
      anotherSubproperty: number;
      objectIdField: ObjectId;
    };
    anotherProperty: boolean;
  };
  anotherTopLevelProperty: Array<{
    subProperty: string;
    anotherObjectId: ObjectId;
  }>;
};

// Example usage
const updateSet: ModelUpdateDocument<DocumentDoc> = {
    _id: { $oid: 'asdas' },
  "property": 
  {
    subproperty: {
        subsubproperty: 'string',
        anotherSubproperty: 1,
        objectIdField: new ObjectId('asdas')
      },
      anotherProperty: true
  },
  "property.subproperty":
  {
        subsubproperty: 'string',
        anotherSubproperty: 1,
        objectIdField: { $oid: 'asdas' }
  },
  "property.subproperty.objectIdField": { $oid: 'asdas' },
  //"anotherTopLevelProperty.subProperty": 'string',
};
