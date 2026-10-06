# Independent encryption fixture

`encrypted-literal.b64` contains a 100 × 100 pt PDF generated with pypdf 6.10.0 and AES-128 (password `Correct-123!`). Its title is `Customer \name (private) / close )`. The ByteStringObject serializer writes cipher bytes as octal-escaped PDF literal strings instead of hex strings. Both are legal PDF syntax. Poppler must read the title exactly before and after unlocking. The fixture has no user data.

This tests a decryption/parser path not exercised by the application's encryption writer, which emits different string/object-stream representations. The generator required pypdf only at fixture creation time; tests consume the checked-in base64 bytes.
