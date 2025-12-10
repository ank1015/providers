npx vitest test/providers/google-schema.test.ts 

 DEV  v4.0.15 /Users/notacoder/Desktop/frontier-agents/providers

 ❯ test/providers/google-schema.test.ts (33 tests | 1 failed) 8ms
   ❯ transformSchemaForGoogle (33)
     ✓ const to enum conversion (4)
       ✓ should convert const to enum with single value 1ms
       ✓ should convert const number to enum 0ms
       ✓ should convert const boolean to enum 0ms
       ✓ should preserve other properties when converting const 0ms
     ✓ anyOf with const values to enum conversion (5)
       ✓ should convert anyOf with const values to enum 0ms
       ✓ should convert anyOf with const and type to enum with type 0ms
       ✓ should preserve parent schema properties 0ms
       ✓ should not convert anyOf without all const values 0ms
       ✓ should handle anyOf with mixed types in const values 0ms
     ✓ Nested object transformation (3)
       ✓ should recursively transform nested object properties 0ms
       ✓ should handle deeply nested objects 0ms
       ✓ should preserve non-const properties unchanged 0ms
     ✓ Array items transformation (3)
       ✓ should recursively transform array items schema 0ms
       ✓ should handle array of objects with const fields 0ms
       ✓ should handle array items with anyOf 0ms
     ✓ Complex union transformations (3)
       ✓ should recursively transform anyOf schemas 0ms
       ✓ should recursively transform oneOf schemas 0ms
       ✓ should recursively transform allOf schemas 0ms
     ✓ TypeBox schema transformation (3)
       ✓ should transform TypeBox Literal to enum 0ms
       ✓ should transform TypeBox Union with Literals 0ms
       ✓ should transform TypeBox Object with Literal properties 0ms
     ❯ Edge cases (8)
       ✓ should handle null input 0ms
       ✓ should handle undefined input 0ms
       ✓ should handle primitive values 0ms
       ✓ should handle empty object 0ms
       ✓ should handle empty array 0ms
       ✓ should handle schema without const or anyOf 0ms
       × should handle anyOf with empty array 4ms
       ✓ should handle const with null value 0ms
     ✓ Real-world tool schemas (3)
       ✓ should transform calculator tool schema 0ms
       ✓ should transform search tool schema with filters 0ms
       ✓ should transform complex nested tool schema 0ms
     ✓ Array schema handling (1)
       ✓ should transform array of schemas 0ms

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯

 FAIL  test/providers/google-schema.test.ts > transformSchemaForGoogle > Edge cases > should handle anyOf with empty array
AssertionError: expected { enum: [] } to match object { anyOf: [] }
(1 matching property omitted from actual)

- Expected
+ Received

  {
-   "anyOf": [],
+   "enum": [],
  }

 ❯ test/providers/google-schema.test.ts:528:19
    526|    const result = transformSchemaForGoogle(schema);
    527| 
    528|    expect(result).toMatchObject({ anyOf: [] });
       |                   ^
    529|   });
    530| 

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯


 Test Files  1 failed (1)
      Tests  1 failed | 32 passed (33)
   Start at  11:28:42
   Duration  132ms (transform 22ms, setup 0ms, import 52ms, tests 8ms, environment 0ms)

 FAIL  Tests failed. Watching for file changes...
       press h to show help, press q to quit